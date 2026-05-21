import bcrypt from 'bcryptjs';

const SESSION_COOKIE_NAME = 'sessao24h';
const SESSION_DURATION_SECONDS = 60 * 60 * 24;
const TEST_USERNAME = 'teste';
const PROTECTED_PAGES = new Set([
    '/dashboard.html',
    '/event.html',
    '/entrada.html',
    '/saida.html'
]);

export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            if (url.pathname.startsWith('/api/')) {
                return handleApiRequest(request, env);
            }

            return handlePageRequest(request, env);
        } catch (error) {
            console.error('Worker error:', error);
            return json({ error: 'Erro interno do servidor' }, 500);
        }
    }
};

async function handlePageRequest(request, env) {
    const url = new URL(request.url);
    const session = await getSessionFromRequest(request, env);

    if ((url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/login.html') && session) {
        return Response.redirect(new URL('/dashboard.html', url.origin), 302);
    }

    if (PROTECTED_PAGES.has(url.pathname) && !session) {
        return Response.redirect(new URL('/login.html', url.origin), 302);
    }

    return env.ASSETS.fetch(request);
}

async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/login' && request.method === 'POST') {
        return login(request, env);
    }

    if (pathname === '/api/logout' && request.method === 'POST') {
        return logout(request, env);
    }

    if (pathname === '/api/auth/status' && request.method === 'GET') {
        const session = await getSessionFromRequest(request, env);
        return json({
            authenticated: !!session,
            isTestUser: session?.username === TEST_USERNAME,
            userId: session?.user_id || null,
            username: session?.username || null,
            isAdmin: session?.role === 'admin'
        });
    }

    const session = await getSessionFromRequest(request, env);
    if (!session) {
        return json({ error: 'Nao autorizado' }, 401);
    }

    if (pathname === '/api/users' && request.method === 'GET') {
        if (!isAdminSession(session)) {
            return json({ error: 'Acesso restrito a administradores' }, 403);
        }

        const users = await queryAll(
            env,
            `SELECT id, username, COALESCE(role, 'user') AS role
             FROM users
             ORDER BY lower(username) ASC`
        );
        return json({
            users,
            canChangePasswords: isAdminSession(session)
        });
    }

    if (pathname === '/api/users' && request.method === 'POST') {
        if (!isAdminSession(session)) {
            return json({ error: 'Acesso restrito a administradores' }, 403);
        }

        const body = await readJson(request);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        const role = String(body.role || 'user').trim() === 'admin' ? 'admin' : 'user';

        if (!username) return json({ error: 'Usuario e obrigatorio' }, 400);
        if (password.trim().length < 4) {
            return json({ error: 'A senha deve ter pelo menos 4 caracteres' }, 400);
        }

        const existingUser = await queryFirst(env, 'SELECT id FROM users WHERE lower(username) = lower(?)', [username]);
        if (existingUser) {
            return json({ error: 'Ja existe um usuario com esse nome' }, 409);
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const result = await execute(
            env,
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, passwordHash, role]
        );
        return json({ id: result.meta.last_row_id, username, role, success: true });
    }

    const userPasswordMatch = pathname.match(/^\/api\/users\/(\d+)\/password$/);
    if (userPasswordMatch && request.method === 'PATCH') {
        if (!isAdminSession(session)) {
            return json({ error: 'Acesso restrito a administradores' }, 403);
        }

        const userId = Number(userPasswordMatch[1]);
        const body = await readJson(request);
        const password = String(body.password || '');
        if (!userId) return json({ error: 'Usuario invalido' }, 400);
        if (password.trim().length < 4) {
            return json({ error: 'A senha deve ter pelo menos 4 caracteres' }, 400);
        }

        const user = await queryFirst(env, 'SELECT id FROM users WHERE id = ?', [userId]);
        if (!user) return json({ error: 'Usuario nao encontrado' }, 404);

        const passwordHash = bcrypt.hashSync(password, 10);
        await execute(env, 'UPDATE users SET password = ? WHERE id = ?', [passwordHash, userId]);
        await execute(env, 'DELETE FROM sessions WHERE user_id = ?', [userId]);
        return json({ success: true });
    }

    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && request.method === 'DELETE') {
        if (!isAdminSession(session)) {
            return json({ error: 'Acesso restrito a administradores' }, 403);
        }

        const userId = Number(userMatch[1]);
        if (!userId) return json({ error: 'Usuario invalido' }, 400);

        const user = await queryFirst(env, 'SELECT id, username, COALESCE(role, "user") AS role FROM users WHERE id = ?', [userId]);
        if (!user) return json({ error: 'Usuario nao encontrado' }, 404);
        if (Number(user.id) === Number(session.user_id)) {
            return json({ error: 'Voce nao pode excluir seu proprio usuario' }, 400);
        }

        if (user.role === 'admin') {
            const adminCount = await queryFirst(env, 'SELECT COUNT(*) AS total FROM users WHERE role = "admin"');
            if (Number(adminCount?.total) <= 1) {
                return json({ error: 'Nao e possivel excluir o ultimo administrador' }, 400);
            }
        }

        await execute(env, 'DELETE FROM sessions WHERE user_id = ?', [userId]);
        await execute(env, 'DELETE FROM users WHERE id = ?', [userId]);
        return json({ success: true });
    }

    if (pathname === '/api/events' && request.method === 'GET') {
        const rows = await getEventsByCompletion(env, 'event', false);
        return json(rows);
    }

    if (pathname === '/api/events' && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        const date = String(body.date || '').trim();
        const session = await getSessionFromRequest(request, env);

        if (!name || !date) {
            return json({ error: 'Nome e data sao obrigatorios' }, 400);
        }

        const result = await execute(
            env,
            "INSERT INTO events (name, date, created_by_username, event_type) VALUES (?, ?, ?, 'event')",
            [name, date, session?.username || null]
        );
        return json({ id: result.meta.last_row_id, success: true });
    }

    if (pathname === '/api/rental-events' && request.method === 'GET') {
        const rows = await getEventsByCompletion(env, 'rental', false);
        return json(rows);
    }

    if (pathname === '/api/history-events' && request.method === 'GET') {
        const [events, rentals] = await Promise.all([
            getEventsByCompletion(env, 'event', true),
            getEventsByCompletion(env, 'rental', true)
        ]);
        return json({ events, rentals });
    }

    if (pathname === '/api/rental-return-alerts' && request.method === 'GET') {
        const today = String(url.searchParams.get('today') || new Date().toISOString().slice(0, 10)).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
            return json({ error: 'Data invalida' }, 400);
        }

        const alerts = await getRentalReturnAlerts(env, today);
        return json(alerts);
    }

    if (pathname === '/api/rental-events' && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        const withdrawalDate = String(body.withdrawalDate || '').trim();
        const returnDate = String(body.returnDate || '').trim();
        const session = await getSessionFromRequest(request, env);

        if (!name || !withdrawalDate || !returnDate) {
            return json({ error: 'Nome, data de retirada e data de devolucao sao obrigatorios' }, 400);
        }

        if (returnDate < withdrawalDate) {
            return json({ error: 'A data de devolucao nao pode ser anterior a data de retirada' }, 400);
        }

        const result = await execute(
            env,
            `INSERT INTO events (name, date, created_by_username, event_type, withdrawal_date, return_date)
             VALUES (?, ?, ?, 'rental', ?, ?)`,
            [name, withdrawalDate, session?.username || null, withdrawalDate, returnDate]
        );
        return json({ id: result.meta.last_row_id, success: true });
    }

    const rentalEventMatch = pathname.match(/^\/api\/rental-events\/(\d+)$/);
    if (rentalEventMatch && request.method === 'GET') {
        const event = await queryFirst(
            env,
            "SELECT * FROM events WHERE id = ? AND COALESCE(event_type, 'event') = 'rental'",
            [Number(rentalEventMatch[1])]
        );
        if (!event) return json({ error: 'Locação nao encontrada' }, 404);
        return json(event);
    }

    if (rentalEventMatch && request.method === 'DELETE') {
        const body = await readJson(request);
        const password = String(body.password || '').trim();

        if (!(await verifyDeletePassword(password, env))) {
            return json({ message: 'Senha incorreta' }, 403);
        }

        const eventId = Number(rentalEventMatch[1]);
        const event = await queryFirst(
            env,
            "SELECT id FROM events WHERE id = ? AND COALESCE(event_type, 'event') = 'rental'",
            [eventId]
        );
        if (!event) return json({ error: 'Locação nao encontrada' }, 404);

        await deleteEventRecords(env, eventId);
        return json({ success: true });
    }

    const eventMatch = pathname.match(/^\/api\/events\/(\d+)$/);
    if (eventMatch && request.method === 'GET') {
        const event = await queryFirst(env, 'SELECT * FROM events WHERE id = ?', [Number(eventMatch[1])]);
        if (!event) return json({ error: 'Evento nao encontrado' }, 404);
        return json(event);
    }

    const historyMatch = pathname.match(/^\/api\/events\/(\d+)\/history$/);
    if (historyMatch && request.method === 'GET') {
        await ensureSaidaHiddenItemsTable(env);
        const rows = await queryAll(
            env,
            `SELECT
                ee.id,
                ee.equipment_id,
                ee.event_id,
                ee.action_type,
                ee.performed_by_username,
                ee.created_at,
                e.name AS equipment_name,
                e.barcode
             FROM equipment_events ee
             INNER JOIN equipments e ON e.id = ee.equipment_id
             WHERE ee.event_id = ?
               AND NOT EXISTS (
                    SELECT 1
                    FROM event_saida_hidden_items hidden
                    WHERE hidden.event_id = ee.event_id
                      AND hidden.item_type = 'equipment'
                      AND hidden.item_id = ee.equipment_id
               )
             ORDER BY datetime(ee.created_at) ASC, ee.id ASC`,
            [Number(historyMatch[1])]
        );
        return json(rows);
    }

    const cableHistoryMatch = pathname.match(/^\/api\/events\/(\d+)\/cable-history$/);
    if (cableHistoryMatch && request.method === 'GET') {
        await ensureSaidaHiddenItemsTable(env);
        const rows = await queryAll(
            env,
            `SELECT
                cem.cable_id,
                c.name,
                SUM(cem.quantity) AS quantity
             FROM cable_event_movements cem
             INNER JOIN cables c ON c.id = cem.cable_id
             WHERE cem.event_id = ?
               AND cem.action_type = 'saida'
               AND NOT EXISTS (
                    SELECT 1
                    FROM event_saida_hidden_items hidden
                    WHERE hidden.event_id = cem.event_id
                      AND hidden.item_type = 'cable'
                      AND hidden.item_id = cem.cable_id
               )
             GROUP BY cem.cable_id, c.name
             ORDER BY lower(c.name) ASC, cem.cable_id ASC`,
            [Number(cableHistoryMatch[1])]
        );
        return json(rows);
    }

    const cableSummaryMatch = pathname.match(/^\/api\/events\/(\d+)\/cable-summary$/);
    if (cableSummaryMatch && request.method === 'GET') {
        await ensureSaidaHiddenItemsTable(env);
        const rows = await queryAll(
            env,
            `SELECT
                cem.cable_id,
                c.name,
                SUM(CASE WHEN cem.action_type = 'saida' THEN cem.quantity ELSE 0 END) AS saida,
                SUM(CASE WHEN cem.action_type = 'entrada' THEN cem.quantity ELSE 0 END) AS entrada,
                SUM(CASE WHEN cem.action_type = 'saida' THEN cem.quantity ELSE -cem.quantity END) AS final
             FROM cable_event_movements cem
             INNER JOIN cables c ON c.id = cem.cable_id
             WHERE cem.event_id = ?
               AND NOT EXISTS (
                    SELECT 1
                    FROM event_saida_hidden_items hidden
                    WHERE hidden.event_id = cem.event_id
                      AND hidden.item_type = 'cable'
                      AND hidden.item_id = cem.cable_id
               )
             GROUP BY cem.cable_id, c.name
             ORDER BY lower(c.name) ASC, cem.cable_id ASC`,
            [Number(cableSummaryMatch[1])]
        );
        return json(rows);
    }

    const otherItemSummaryMatch = pathname.match(/^\/api\/events\/(\d+)\/other-item-summary$/);
    if (otherItemSummaryMatch && request.method === 'GET') {
        await ensureSaidaHiddenItemsTable(env);
        const rows = await queryAll(
            env,
            `SELECT
                oiem.item_id,
                oi.name,
                SUM(CASE WHEN oiem.action_type = 'saida' THEN oiem.quantity ELSE 0 END) AS saida,
                SUM(CASE WHEN oiem.action_type = 'entrada' THEN oiem.quantity ELSE 0 END) AS entrada,
                SUM(CASE WHEN oiem.action_type = 'saida' THEN oiem.quantity ELSE -oiem.quantity END) AS final
             FROM other_item_event_movements oiem
             INNER JOIN other_items oi ON oi.id = oiem.item_id
             WHERE oiem.event_id = ?
               AND NOT EXISTS (
                    SELECT 1
                    FROM event_saida_hidden_items hidden
                    WHERE hidden.event_id = oiem.event_id
                      AND hidden.item_type = 'other'
                      AND hidden.item_id = oiem.item_id
               )
             GROUP BY oiem.item_id, oi.name
             ORDER BY lower(oi.name) ASC, oiem.item_id ASC`,
            [Number(otherItemSummaryMatch[1])]
        );
        return json(rows);
    }

    const hideSaidaItemMatch = pathname.match(/^\/api\/events\/(\d+)\/saida-hidden-items$/);
    if (hideSaidaItemMatch && request.method === 'POST') {
        const eventId = Number(hideSaidaItemMatch[1]);
        const body = await readJson(request);
        const itemType = String(body.itemType || '').trim();
        const itemId = Number(body.itemId);
        const password = String(body.password || '').trim();

        if (!(await verifyDeletePassword(password, env))) {
            return json({ message: 'Senha incorreta' }, 403);
        }

        if (!eventId || !['equipment', 'cable', 'other'].includes(itemType) || !itemId) {
            return json({ message: 'Dados invalidos para excluir da saida' }, 400);
        }

        await ensureSaidaHiddenItemsTable(env);
        await execute(
            env,
            `INSERT OR IGNORE INTO event_saida_hidden_items (event_id, item_type, item_id)
             VALUES (?, ?, ?)`,
            [eventId, itemType, itemId]
        );
        return json({ success: true });
    }

    if (eventMatch && request.method === 'DELETE') {
        const eventId = Number(eventMatch[1]);
        await deleteEventRecords(env, eventId);
        return json({ success: true });
    }

    if (pathname === '/api/equipments' && request.method === 'GET') {
        const search = String(url.searchParams.get('search') || '').trim();
        const rows = await queryAll(
            env,
            `SELECT
                equipments.*,
                (
                    SELECT events.name
                    FROM equipment_events ee
                    INNER JOIN events ON events.id = ee.event_id
                    WHERE ee.equipment_id = equipments.id
                      AND ee.action_type = 'saida'
                      AND NOT EXISTS (
                          SELECT 1
                          FROM equipment_events ee2
                          WHERE ee2.equipment_id = ee.equipment_id
                            AND ee2.event_id = ee.event_id
                            AND ee2.action_type = 'entrada'
                            AND (
                                datetime(ee2.created_at) > datetime(ee.created_at)
                                OR (
                                    datetime(ee2.created_at) = datetime(ee.created_at)
                                    AND ee2.id > ee.id
                                )
                            )
                      )
                    ORDER BY datetime(ee.created_at) DESC, ee.id DESC
                    LIMIT 1
                ) AS current_event_name,
                (
                    SELECT m.description
                    FROM maintenances m
                    WHERE m.equipment_id = equipments.id
                      AND m.resolved_at IS NULL
                    ORDER BY datetime(m.created_at) DESC, m.id DESC
                    LIMIT 1
                ) AS maintenance_description
             FROM equipments
             WHERE name LIKE ? OR barcode LIKE ? OR category LIKE ?
             ORDER BY category ASC, name ASC`,
            [`%${search}%`, `%${search}%`, `%${search}%`]
        );
        return json(rows);
    }

    if (pathname === '/api/equipments' && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        const barcode = String(body.barcode || '').trim();
        const category = String(body.category || 'Outros').trim() || 'Outros';

        if (!name || !barcode) {
            return json({ error: 'Nome e codigo de barras sao obrigatorios' }, 400);
        }

        try {
            const result = await execute(
                env,
                'INSERT INTO equipments (name, barcode, current_status, category) VALUES (?, ?, ?, ?)',
                [name, barcode, 'Disponivel', category]
            );
            return json({ id: result.meta.last_row_id, success: true });
        } catch (error) {
            return handleDatabaseError(error, 'Ja existe um equipamento com esse codigo de barras');
        }
    }

    const equipmentStatusMatch = pathname.match(/^\/api\/equipments\/(\d+)\/status$/);
    if (equipmentStatusMatch && request.method === 'PATCH') {
        const equipmentId = Number(equipmentStatusMatch[1]);
        const body = await readJson(request);
        const status = String(body.status || '').trim();

        if (!equipmentId || !status) {
            return json({ message: 'id e status sao obrigatorios' }, 400);
        }

        const equipment = await queryFirst(env, 'SELECT * FROM equipments WHERE id = ?', [equipmentId]);
        if (!equipment) return json({ message: 'Equipamento nao encontrado' }, 404);

        await execute(env, 'UPDATE equipments SET current_status = ? WHERE id = ?', [status, equipmentId]);
        return json({ success: true });
    }

    if (pathname === '/api/cables' && request.method === 'GET') {
        const search = String(url.searchParams.get('search') || '').trim();
        const rows = await queryAll(
            env,
            `SELECT
                cables.*,
                (
                    SELECT cm.description
                    FROM cable_maintenances cm
                    WHERE cm.cable_id = cables.id
                      AND cm.resolved_at IS NULL
                    ORDER BY datetime(cm.created_at) DESC, cm.id DESC
                    LIMIT 1
                ) AS maintenance_description
             FROM cables
             WHERE name LIKE ? OR category LIKE ?
             ORDER BY category ASC, name ASC`,
            [`%${search}%`, `%${search}%`]
        );
        return json(rows);
    }

    if (pathname === '/api/cables' && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        const quantity = Number(body.quantity);
        const category = String(body.category || 'Outros').trim() || 'Outros';

        if (!name) return json({ error: 'Nome do cabo e obrigatorio' }, 400);
        if (!Number.isInteger(quantity) || quantity < 0) {
            return json({ error: 'Quantidade invalida' }, 400);
        }

        try {
            const result = await execute(
                env,
                `INSERT INTO cables (name, quantity, available_quantity, category, updated_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [name, quantity, quantity, category]
            );
            return json({ id: result.meta.last_row_id, success: true });
        } catch (error) {
            return handleDatabaseError(error, 'Ja existe um cabo com esse nome');
        }
    }

    const cableMatch = pathname.match(/^\/api\/cables\/(\d+)$/);
    if (cableMatch && request.method === 'PATCH') {
        const cableId = Number(cableMatch[1]);
        const body = await readJson(request);
        const quantity = Number(body.quantity);

        if (!cableId) return json({ message: 'id do cabo e obrigatorio' }, 400);
        if (!Number.isInteger(quantity) || quantity < 0) {
            return json({ message: 'Quantidade invalida' }, 400);
        }

        const cable = await queryFirst(env, 'SELECT * FROM cables WHERE id = ?', [cableId]);
        if (!cable) return json({ message: 'Cabo nao encontrado' }, 404);

        await execute(
            env,
            `UPDATE cables
             SET quantity = ?, available_quantity = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [quantity, quantity, cableId]
        );

        return json({ success: true });
    }

    if (cableMatch && request.method === 'DELETE') {
        const cableId = Number(cableMatch[1]);
        const body = await readJson(request);
        const password = String(body.password || '').trim();

        if (!cableId) return json({ message: 'id do cabo e obrigatorio' }, 400);
        if (!(await verifyDeletePassword(password, env))) return json({ message: 'Senha incorreta' }, 403);

        const cable = await queryFirst(env, 'SELECT * FROM cables WHERE id = ?', [cableId]);
        if (!cable) return json({ message: 'Cabo nao encontrado' }, 404);

        await execute(env, 'DELETE FROM cable_event_movements WHERE cable_id = ?', [cableId]);
        await execute(env, 'DELETE FROM cable_maintenances WHERE cable_id = ?', [cableId]);
        await execute(env, 'DELETE FROM cables WHERE id = ?', [cableId]);
        return json({ success: true });
    }

    if (pathname === '/api/other-items' && request.method === 'GET') {
        const search = String(url.searchParams.get('search') || '').trim();
        const rows = await queryAll(
            env,
            `SELECT *
             FROM other_items
             WHERE name LIKE ?
             ORDER BY name ASC`,
            [`%${search}%`]
        );
        return json(rows);
    }

    if (pathname === '/api/other-items' && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        const quantity = Number(body.quantity);

        if (!name) return json({ error: 'Nome do item e obrigatorio' }, 400);
        if (!Number.isInteger(quantity) || quantity < 0) {
            return json({ error: 'Quantidade invalida' }, 400);
        }

        try {
            const result = await execute(
                env,
                `INSERT INTO other_items (name, quantity, available_quantity, updated_at)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [name, quantity, quantity]
            );
            return json({ id: result.meta.last_row_id, success: true });
        } catch (error) {
            return handleDatabaseError(error, 'Ja existe um item com esse nome');
        }
    }

    const otherItemMatch = pathname.match(/^\/api\/other-items\/(\d+)$/);
    if (otherItemMatch && request.method === 'PATCH') {
        const itemId = Number(otherItemMatch[1]);
        const body = await readJson(request);
        const quantity = Number(body.quantity);

        if (!itemId) return json({ message: 'id do item e obrigatorio' }, 400);
        if (!Number.isInteger(quantity) || quantity < 0) {
            return json({ message: 'Quantidade invalida' }, 400);
        }

        const item = await queryFirst(env, 'SELECT * FROM other_items WHERE id = ?', [itemId]);
        if (!item) return json({ message: 'Item nao encontrado' }, 404);

        await execute(
            env,
            `UPDATE other_items
             SET quantity = ?, available_quantity = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [quantity, quantity, itemId]
        );

        return json({ success: true });
    }

    if (otherItemMatch && request.method === 'DELETE') {
        const itemId = Number(otherItemMatch[1]);
        const body = await readJson(request);
        const password = String(body.password || '').trim();

        if (!itemId) return json({ message: 'id do item e obrigatorio' }, 400);
        if (!(await verifyDeletePassword(password, env))) return json({ message: 'Senha incorreta' }, 403);

        const item = await queryFirst(env, 'SELECT * FROM other_items WHERE id = ?', [itemId]);
        if (!item) return json({ message: 'Item nao encontrado' }, 404);

        await execute(env, 'DELETE FROM other_item_event_movements WHERE item_id = ?', [itemId]);
        await execute(env, 'DELETE FROM other_items WHERE id = ?', [itemId]);
        return json({ success: true });
    }

    const equipmentMatch = pathname.match(/^\/api\/equipments\/(\d+)$/);
    if (equipmentMatch && request.method === 'DELETE') {
        const equipmentId = Number(equipmentMatch[1]);
        const body = await readJson(request);
        const password = String(body.password || '').trim();

        if (!equipmentId) return json({ message: 'id do equipamento e obrigatorio' }, 400);
        if (!(await verifyDeletePassword(password, env))) return json({ message: 'Senha incorreta' }, 403);

        const equipment = await queryFirst(env, 'SELECT * FROM equipments WHERE id = ?', [equipmentId]);
        if (!equipment) return json({ message: 'Equipamento nao encontrado' }, 404);

        await execute(env, 'DELETE FROM equipment_events WHERE equipment_id = ?', [equipmentId]);
        await execute(env, 'DELETE FROM maintenances WHERE equipment_id = ?', [equipmentId]);
        await execute(env, 'DELETE FROM equipments WHERE id = ?', [equipmentId]);
        return json({ success: true });
    }

    const movementMatch = pathname.match(/^\/api\/equipment-events\/(saida|entrada)$/);
    if (movementMatch && request.method === 'POST') {
        const type = movementMatch[1];
        const body = await readJson(request);
        const equipmentId = Number(body.equipmentId);
        const barcode = String(body.barcode || '').trim();
        const eventId = Number(body.eventId);
        const session = await getSessionFromRequest(request, env);
        const performedByUsername = session?.username || null;

        if ((!equipmentId && !barcode) || !eventId) {
            return json({ message: 'equipmentId ou codigo de barras e eventId sao obrigatorios' }, 400);
        }

        const equipment = equipmentId
            ? await queryFirst(env, 'SELECT * FROM equipments WHERE id = ?', [equipmentId])
            : await queryFirst(env, 'SELECT * FROM equipments WHERE barcode = ?', [barcode]);
        const event = await queryFirst(env, 'SELECT * FROM events WHERE id = ?', [eventId]);
        const resolvedEquipmentId = Number(equipment?.id);

        if (!equipment) return json({ message: 'Equipamento nao encontrado' }, 404);
        if (!event) return json({ message: 'Evento nao encontrado' }, 404);

        if (type === 'saida') {
            if (!isAvailableStatus(equipment.current_status)) {
                return json({ message: 'Equipamento ja esta indisponivel' }, 409);
            }

            await execute(
                env,
                "INSERT INTO equipment_events (equipment_id, event_id, action_type, performed_by_username) VALUES (?, ?, 'saida', ?)",
                [resolvedEquipmentId, eventId, performedByUsername]
            );
            await execute(env, "UPDATE equipments SET current_status = 'Indisponivel' WHERE id = ?", [resolvedEquipmentId]);
            return json({ success: true, equipment });
        }

        const lastMovement = await queryFirst(
            env,
            `SELECT action_type
             FROM equipment_events
             WHERE equipment_id = ? AND event_id = ?
             ORDER BY datetime(created_at) DESC, id DESC
             LIMIT 1`,
            [resolvedEquipmentId, eventId]
        );

        if (!lastMovement || lastMovement.action_type !== 'saida') {
            return json({ message: 'Este equipamento nao possui saida pendente neste evento' }, 409);
        }

        await execute(
            env,
            "INSERT INTO equipment_events (equipment_id, event_id, action_type, performed_by_username) VALUES (?, ?, 'entrada', ?)",
            [resolvedEquipmentId, eventId, performedByUsername]
        );
        await execute(env, "UPDATE equipments SET current_status = 'Disponivel' WHERE id = ?", [resolvedEquipmentId]);
        return json({ success: true, equipment });
    }

    const cableMovementMatch = pathname.match(/^\/api\/cable-events\/(saida|entrada)$/);
    if (cableMovementMatch && request.method === 'POST') {
        const type = cableMovementMatch[1];
        const body = await readJson(request);
        const cableId = Number(body.cableId);
        const eventId = Number(body.eventId);
        const quantity = Number(body.quantity);

        if (!cableId || !eventId || !Number.isInteger(quantity) || quantity <= 0) {
            return json({ message: 'cableId, eventId e quantity sao obrigatorios' }, 400);
        }

        const cable = await queryFirst(env, 'SELECT * FROM cables WHERE id = ?', [cableId]);
        const event = await queryFirst(env, 'SELECT * FROM events WHERE id = ?', [eventId]);

        if (!cable) return json({ message: 'Cabo nao encontrado' }, 404);
        if (!event) return json({ message: 'Evento nao encontrado' }, 404);

        if (type === 'saida') {
            if (Number(cable.available_quantity) < quantity) {
                return json({ message: 'Quantidade insuficiente em estoque' }, 409);
            }

            await execute(
                env,
                "INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity) VALUES (?, ?, 'saida', ?)",
                [cableId, eventId, quantity]
            );
            await execute(
                env,
                'UPDATE cables SET available_quantity = available_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [quantity, cableId]
            );
            return json({ success: true });
        }

        const pendingMovement = await queryFirst(
            env,
            `SELECT COALESCE(SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END), 0) AS quantity
             FROM cable_event_movements
             WHERE cable_id = ? AND event_id = ?`,
            [cableId, eventId]
        );

        if (!pendingMovement || Number(pendingMovement.quantity) < quantity) {
            return json({ message: 'Este cabo nao possui saida pendente suficiente neste evento' }, 409);
        }

        await execute(
            env,
            "INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity) VALUES (?, ?, 'entrada', ?)",
            [cableId, eventId, quantity]
        );
        await execute(
            env,
            'UPDATE cables SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [quantity, cableId]
        );
        return json({ success: true });
    }

    const otherItemMovementMatch = pathname.match(/^\/api\/other-item-events\/(saida|entrada)$/);
    if (otherItemMovementMatch && request.method === 'POST') {
        const type = otherItemMovementMatch[1];
        const body = await readJson(request);
        const itemId = Number(body.itemId);
        const eventId = Number(body.eventId);
        const quantity = Number(body.quantity);

        if (!itemId || !eventId || !Number.isInteger(quantity) || quantity <= 0) {
            return json({ message: 'itemId, eventId e quantity sao obrigatorios' }, 400);
        }

        const item = await queryFirst(env, 'SELECT * FROM other_items WHERE id = ?', [itemId]);
        const event = await queryFirst(env, 'SELECT * FROM events WHERE id = ?', [eventId]);

        if (!item) return json({ message: 'Item nao encontrado' }, 404);
        if (!event) return json({ message: 'Evento nao encontrado' }, 404);

        if (type === 'saida') {
            if (Number(item.available_quantity) < quantity) {
                return json({ message: 'Quantidade insuficiente em estoque' }, 409);
            }

            await execute(
                env,
                "INSERT INTO other_item_event_movements (item_id, event_id, action_type, quantity) VALUES (?, ?, 'saida', ?)",
                [itemId, eventId, quantity]
            );
            await execute(
                env,
                'UPDATE other_items SET available_quantity = available_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [quantity, itemId]
            );
            return json({ success: true });
        }

        const pendingMovement = await queryFirst(
            env,
            `SELECT COALESCE(SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END), 0) AS quantity
             FROM other_item_event_movements
             WHERE item_id = ? AND event_id = ?`,
            [itemId, eventId]
        );

        if (!pendingMovement || Number(pendingMovement.quantity) < quantity) {
            return json({ message: 'Este item nao possui saida pendente suficiente neste evento' }, 409);
        }

        await execute(
            env,
            "INSERT INTO other_item_event_movements (item_id, event_id, action_type, quantity) VALUES (?, ?, 'entrada', ?)",
            [itemId, eventId, quantity]
        );
        await execute(
            env,
            'UPDATE other_items SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [quantity, itemId]
        );
        return json({ success: true });
    }

    if (pathname === '/api/maintenances' && request.method === 'POST') {
        const body = await readJson(request);
        const equipmentId = Number(body.equipmentId);
        const description = String(body.description || '').trim();

        if (!equipmentId || !description) {
            return json({ message: 'equipmentId e description sao obrigatorios' }, 400);
        }

        const equipment = await queryFirst(env, 'SELECT * FROM equipments WHERE id = ?', [equipmentId]);
        if (!equipment) return json({ message: 'Equipamento nao encontrado' }, 404);

        await execute(
            env,
            'INSERT INTO maintenances (equipment_id, description) VALUES (?, ?)',
            [equipmentId, description]
        );
        await execute(env, "UPDATE equipments SET current_status = 'Em manutencao' WHERE id = ?", [equipmentId]);
        return json({ success: true });
    }

    if (pathname === '/api/cable-maintenances' && request.method === 'POST') {
        const body = await readJson(request);
        const cableId = Number(body.cableId);
        const description = String(body.description || '').trim();

        if (!cableId || !description) {
            return json({ message: 'cableId e description sao obrigatorios' }, 400);
        }

        const cable = await queryFirst(env, 'SELECT * FROM cables WHERE id = ?', [cableId]);
        if (!cable) return json({ message: 'Cabo nao encontrado' }, 404);

        await execute(
            env,
            'INSERT INTO cable_maintenances (cable_id, description) VALUES (?, ?)',
            [cableId, description]
        );
        return json({ success: true });
    }

    const maintenanceReadyMatch = pathname.match(/^\/api\/maintenances\/(\d+)\/ready$/);
    if (maintenanceReadyMatch && request.method === 'PATCH') {
        const equipmentId = Number(maintenanceReadyMatch[1]);
        if (!equipmentId) return json({ message: 'equipmentId e obrigatorio' }, 400);

        const equipment = await queryFirst(env, 'SELECT * FROM equipments WHERE id = ?', [equipmentId]);
        if (!equipment) return json({ message: 'Equipamento nao encontrado' }, 404);

        await execute(
            env,
            `UPDATE maintenances
             SET resolved_at = CURRENT_TIMESTAMP
             WHERE equipment_id = ?
               AND resolved_at IS NULL`,
            [equipmentId]
        );
        await execute(env, "UPDATE equipments SET current_status = 'Disponivel' WHERE id = ?", [equipmentId]);
        return json({ success: true });
    }

    const cableMaintenanceReadyMatch = pathname.match(/^\/api\/cable-maintenances\/(\d+)\/ready$/);
    if (cableMaintenanceReadyMatch && request.method === 'PATCH') {
        const cableId = Number(cableMaintenanceReadyMatch[1]);
        if (!cableId) return json({ message: 'cableId e obrigatorio' }, 400);

        const cable = await queryFirst(env, 'SELECT * FROM cables WHERE id = ?', [cableId]);
        if (!cable) return json({ message: 'Cabo nao encontrado' }, 404);

        await execute(
            env,
            `UPDATE cable_maintenances
             SET resolved_at = CURRENT_TIMESTAMP
             WHERE cable_id = ?
               AND resolved_at IS NULL`,
            [cableId]
        );
        return json({ success: true });
    }

    return json({ error: 'Rota nao encontrada' }, 404);
}

async function login(request, env) {
    const body = await readJson(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
        return json({ error: 'Usuario e senha sao obrigatorios' }, 400);
    }

    const user = await queryFirst(env, 'SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return json({ error: 'Incorreto' }, 401);
    }

    await cleanupExpiredSessions(env);
    await cleanupCurrentSessionBeforeLogin(request, env);

    if (user.username === TEST_USERNAME) {
        await clearAllTestUserSessions(env);
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = toSqliteDate(new Date(Date.now() + SESSION_DURATION_SECONDS * 1000));

    if (user.username === TEST_USERNAME) {
        await createTestSnapshot(env, sessionId);
    }

    await execute(
        env,
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
        [sessionId, user.id, expiresAt]
    );

    return json(
        { success: true, isTestUser: user.username === TEST_USERNAME },
        200,
        { 'Set-Cookie': await buildSessionCookie(sessionId, request, env) }
    );
}

async function cleanupCurrentSessionBeforeLogin(request, env) {
    const currentSession = await getSessionFromRequest(request, env);
    if (!currentSession) {
        return;
    }

    if (currentSession.username === TEST_USERNAME) {
        await restoreTestSnapshot(env, currentSession.id);
        await clearTestSnapshot(env, currentSession.id);
    }

    await execute(env, 'DELETE FROM sessions WHERE id = ?', [currentSession.id]);
}

async function logout(request, env) {
    const session = await getSessionFromRequest(request, env);
    if (session) {
        if (session.username === TEST_USERNAME) {
            await restoreTestSnapshot(env, session.id);
            await clearTestSnapshot(env, session.id);
        }

        await execute(env, 'DELETE FROM sessions WHERE id = ?', [session.id]);
    }

    return json(
        { success: true },
        200,
        { 'Set-Cookie': clearSessionCookie(request) }
    );
}

async function getSessionFromRequest(request, env) {
    const secret = env.SESSION_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET nao configurado no Worker');
    }

    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const rawValue = cookies[SESSION_COOKIE_NAME];
    if (!rawValue) return null;

    const [sessionId, signature] = rawValue.split('.');
    if (!sessionId || !signature) return null;

    const expectedSignature = await signValue(sessionId, secret);
    if (signature !== expectedSignature) return null;

    const session = await queryFirst(
        env,
        `SELECT sessions.id, sessions.user_id, sessions.expires_at, users.username, COALESCE(users.role, 'user') AS role
         FROM sessions
         INNER JOIN users ON users.id = sessions.user_id
         WHERE sessions.id = ?
           AND sessions.expires_at > ?`,
        [sessionId, toSqliteDate(new Date())]
    );

    if (!session) {
        return null;
    }

    return session;
}

function isAdminSession(session) {
    return session?.role === 'admin';
}

async function cleanupExpiredSessions(env) {
    const expiredTestSessions = await queryAll(
        env,
        `SELECT sessions.id
         FROM sessions
         INNER JOIN users ON users.id = sessions.user_id
         WHERE sessions.expires_at <= ?
           AND users.username = ?
         ORDER BY sessions.expires_at ASC`,
        [toSqliteDate(new Date()), TEST_USERNAME]
    );

    for (const session of expiredTestSessions) {
        await clearTestSnapshot(env, session.id);
    }

    await execute(env, 'DELETE FROM sessions WHERE expires_at <= ?', [toSqliteDate(new Date())]);
}

async function clearAllTestUserSessions(env) {
    const testSessions = await queryAll(
        env,
        `SELECT sessions.id
         FROM sessions
         INNER JOIN users ON users.id = sessions.user_id
         WHERE users.username = ?
         ORDER BY sessions.expires_at ASC`,
        [TEST_USERNAME]
    );

    if (testSessions.length === 0) {
        return;
    }

    for (const session of testSessions) {
        await clearTestSnapshot(env, session.id);
    }

    await execute(
        env,
        `DELETE FROM sessions
         WHERE id IN (${testSessions.map(() => '?').join(', ')})`,
        testSessions.map((session) => session.id)
    );
}

async function createTestSnapshot(env, snapshotId) {
    await clearTestSnapshot(env, snapshotId);

    await execute(
        env,
        `INSERT INTO test_snapshot_equipments (snapshot_id, id, name, barcode, current_status, category)
         SELECT ?, id, name, barcode, current_status, category
         FROM equipments`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO test_snapshot_events (snapshot_id, id, name, date, created_by_username, event_type, withdrawal_date, return_date)
         SELECT ?, id, name, date, created_by_username, COALESCE(event_type, 'event'), withdrawal_date, return_date
         FROM events`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO test_snapshot_equipment_events (snapshot_id, id, equipment_id, event_id, action_type, performed_by_username, created_at)
         SELECT ?, id, equipment_id, event_id, action_type, performed_by_username, created_at
         FROM equipment_events`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO test_snapshot_cable_event_movements (snapshot_id, id, cable_id, event_id, action_type, quantity, created_at)
         SELECT ?, id, cable_id, event_id, action_type, quantity, created_at
         FROM cable_event_movements`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO test_snapshot_maintenances (snapshot_id, id, equipment_id, description, resolved_at, created_at)
         SELECT ?, id, equipment_id, description, resolved_at, created_at
         FROM maintenances`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO test_snapshot_cables (snapshot_id, id, name, quantity, available_quantity, category, created_at, updated_at)
         SELECT ?, id, name, quantity, available_quantity, category, created_at, updated_at
         FROM cables`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO test_snapshot_cable_maintenances (snapshot_id, id, cable_id, description, resolved_at, created_at)
         SELECT ?, id, cable_id, description, resolved_at, created_at
         FROM cable_maintenances`,
        [snapshotId]
    );
}

async function restoreTestSnapshot(env, snapshotId) {
    await execute(env, 'DELETE FROM equipment_events');
    await execute(env, 'DELETE FROM cable_event_movements');
    await execute(env, 'DELETE FROM maintenances');
    await execute(env, 'DELETE FROM events');
    await execute(env, 'DELETE FROM equipments');
    await execute(env, 'DELETE FROM cable_maintenances');
    await execute(env, 'DELETE FROM cables');

    await execute(
        env,
        `INSERT INTO equipments (id, name, barcode, current_status, category)
         SELECT id, name, barcode, current_status, category
         FROM test_snapshot_equipments
         WHERE snapshot_id = ?`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO events (id, name, date, created_by_username, event_type, withdrawal_date, return_date)
         SELECT id, name, date, created_by_username, COALESCE(event_type, 'event'), withdrawal_date, return_date
         FROM test_snapshot_events
         WHERE snapshot_id = ?`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO equipment_events (id, equipment_id, event_id, action_type, performed_by_username, created_at)
         SELECT id, equipment_id, event_id, action_type, performed_by_username, created_at
         FROM test_snapshot_equipment_events
         WHERE snapshot_id = ?`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO cable_event_movements (id, cable_id, event_id, action_type, quantity, created_at)
         SELECT id, cable_id, event_id, action_type, quantity, created_at
         FROM test_snapshot_cable_event_movements
         WHERE snapshot_id = ?`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO maintenances (id, equipment_id, description, resolved_at, created_at)
         SELECT id, equipment_id, description, resolved_at, created_at
         FROM test_snapshot_maintenances
         WHERE snapshot_id = ?`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO cables (id, name, quantity, available_quantity, category, created_at, updated_at)
         SELECT id, name, quantity, available_quantity, category, created_at, updated_at
         FROM test_snapshot_cables
         WHERE snapshot_id = ?`,
        [snapshotId]
    );

    await execute(
        env,
        `INSERT INTO cable_maintenances (id, cable_id, description, resolved_at, created_at)
         SELECT id, cable_id, description, resolved_at, created_at
         FROM test_snapshot_cable_maintenances
         WHERE snapshot_id = ?`,
        [snapshotId]
    );
}

async function clearTestSnapshot(env, snapshotId) {
    await execute(env, 'DELETE FROM test_snapshot_equipment_events WHERE snapshot_id = ?', [snapshotId]);
    await execute(env, 'DELETE FROM test_snapshot_cable_event_movements WHERE snapshot_id = ?', [snapshotId]);
    await execute(env, 'DELETE FROM test_snapshot_maintenances WHERE snapshot_id = ?', [snapshotId]);
    await execute(env, 'DELETE FROM test_snapshot_events WHERE snapshot_id = ?', [snapshotId]);
    await execute(env, 'DELETE FROM test_snapshot_equipments WHERE snapshot_id = ?', [snapshotId]);
    await execute(env, 'DELETE FROM test_snapshot_cable_maintenances WHERE snapshot_id = ?', [snapshotId]);
    await execute(env, 'DELETE FROM test_snapshot_cables WHERE snapshot_id = ?', [snapshotId]);
}

async function buildSessionCookie(sessionId, request, env) {
    const signature = await signValue(sessionId, env.SESSION_SECRET);
    const url = new URL(request.url);
    const isSecure = url.protocol === 'https:';
    return [
        `${SESSION_COOKIE_NAME}=${sessionId}.${signature}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${SESSION_DURATION_SECONDS}`,
        isSecure ? 'Secure' : ''
    ].filter(Boolean).join('; ');
}

function clearSessionCookie(request) {
    const url = new URL(request.url);
    const isSecure = url.protocol === 'https:';
    return [
        `${SESSION_COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0',
        isSecure ? 'Secure' : ''
    ].filter(Boolean).join('; ');
}

async function signValue(value, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
    return toBase64Url(signature);
}

async function verifyDeletePassword(password, env) {
    const passwordHash = String(env.DELETE_PASSWORD_HASH || '').trim();
    if (!passwordHash) {
        console.warn('DELETE_PASSWORD_HASH nao configurado no Worker.');
        return false;
    }

    return bcrypt.compare(password, passwordHash);
}

async function getEventsByCompletion(env, eventType, completed) {
    const orderBy = eventType === 'rental'
        ? 'ORDER BY COALESCE(e.return_date, e.date) DESC, e.id DESC'
        : 'ORDER BY e.date DESC, e.id DESC';
    const completionFilter = completed
        ? 'COALESCE(movements.movement_count, 0) > 0 AND COALESCE(pending.pending_quantity, 0) = 0'
        : '(COALESCE(movements.movement_count, 0) = 0 OR COALESCE(pending.pending_quantity, 0) > 0)';

    return queryAll(
        env,
        `SELECT e.*
         FROM events e
         LEFT JOIN (
             SELECT event_id, COUNT(*) AS movement_count
             FROM (
                 SELECT event_id FROM equipment_events
                 UNION ALL SELECT event_id FROM cable_event_movements
                 UNION ALL SELECT event_id FROM other_item_event_movements
             ) movement_rows
             GROUP BY event_id
         ) movements ON movements.event_id = e.id
         LEFT JOIN (
             SELECT event_id, SUM(pending_quantity) AS pending_quantity
             FROM (
                 SELECT event_id,
                        SUM(CASE WHEN action_type = 'saida' THEN 1 ELSE -1 END) AS pending_quantity
                 FROM equipment_events
                 GROUP BY event_id, equipment_id
                 HAVING SUM(CASE WHEN action_type = 'saida' THEN 1 ELSE -1 END) > 0

                 UNION ALL

                 SELECT event_id,
                        SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END) AS pending_quantity
                 FROM cable_event_movements
                 GROUP BY event_id, cable_id
                 HAVING SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END) > 0

                 UNION ALL

                 SELECT event_id,
                        SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END) AS pending_quantity
                 FROM other_item_event_movements
                 GROUP BY event_id, item_id
                 HAVING SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END) > 0
             ) pending_rows
             GROUP BY event_id
         ) pending ON pending.event_id = e.id
         WHERE COALESCE(e.event_type, 'event') = ?
           AND ${completionFilter}
         ${orderBy}`,
        [eventType]
    );
}

async function getRentalReturnAlerts(env, today) {
    const rentalEvents = await queryAll(
        env,
        `SELECT *
         FROM events
         WHERE COALESCE(event_type, 'event') = 'rental'
           AND return_date IS NOT NULL
           AND return_date <= ?
         ORDER BY return_date ASC, id ASC`,
        [today]
    );

    const alerts = [];
    for (const event of rentalEvents) {
        const pendingItems = await getPendingRentalItems(env, Number(event.id));
        if (pendingItems.length > 0) {
            alerts.push({ ...event, pendingItems });
        }
    }

    return alerts;
}

async function getPendingRentalItems(env, eventId) {
    const equipments = await queryAll(
        env,
        `SELECT 'equipment' AS type,
                e.id AS item_id,
                e.name,
                e.barcode,
                SUM(CASE WHEN ee.action_type = 'saida' THEN 1 ELSE -1 END) AS quantity
         FROM equipment_events ee
         JOIN equipments e ON e.id = ee.equipment_id
         WHERE ee.event_id = ?
         GROUP BY e.id, e.name, e.barcode
         HAVING SUM(CASE WHEN ee.action_type = 'saida' THEN 1 ELSE -1 END) > 0
         ORDER BY e.name ASC`,
        [eventId]
    );

    const cables = await queryAll(
        env,
        `SELECT 'cable' AS type,
                c.id AS item_id,
                c.name,
                NULL AS barcode,
                SUM(CASE WHEN cem.action_type = 'saida' THEN cem.quantity ELSE -cem.quantity END) AS quantity
         FROM cable_event_movements cem
         JOIN cables c ON c.id = cem.cable_id
         WHERE cem.event_id = ?
         GROUP BY c.id, c.name
         HAVING SUM(CASE WHEN cem.action_type = 'saida' THEN cem.quantity ELSE -cem.quantity END) > 0
         ORDER BY c.name ASC`,
        [eventId]
    );

    const otherItems = await queryAll(
        env,
        `SELECT 'other' AS type,
                oi.id AS item_id,
                oi.name,
                NULL AS barcode,
                SUM(CASE WHEN oiem.action_type = 'saida' THEN oiem.quantity ELSE -oiem.quantity END) AS quantity
         FROM other_item_event_movements oiem
         JOIN other_items oi ON oi.id = oiem.item_id
         WHERE oiem.event_id = ?
         GROUP BY oi.id, oi.name
         HAVING SUM(CASE WHEN oiem.action_type = 'saida' THEN oiem.quantity ELSE -oiem.quantity END) > 0
         ORDER BY oi.name ASC`,
        [eventId]
    );

    return [...equipments, ...cables, ...otherItems].map((item) => ({
        ...item,
        quantity: Math.max(1, Number(item.quantity) || 1)
    }));
}

async function deleteEventRecords(env, eventId) {
    const equipmentsInEvent = await queryAll(
        env,
        'SELECT DISTINCT equipment_id FROM equipment_events WHERE event_id = ?',
        [eventId]
    );

    if (equipmentsInEvent.length > 0) {
        const equipmentIds = equipmentsInEvent.map((row) => row.equipment_id);
        const placeholders = equipmentIds.map(() => '?').join(', ');
        await execute(
            env,
            `UPDATE equipments SET current_status = 'Disponivel' WHERE id IN (${placeholders})`,
            equipmentIds
        );
    }

    const cablesInEvent = await queryAll(
        env,
        `SELECT cable_id,
                SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END) AS quantity
         FROM cable_event_movements
         WHERE event_id = ?
         GROUP BY cable_id
         HAVING quantity > 0`,
        [eventId]
    );

    for (const cableMovement of cablesInEvent) {
        await execute(
            env,
            'UPDATE cables SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [cableMovement.quantity, cableMovement.cable_id]
        );
    }

    const otherItemsInEvent = await queryAll(
        env,
        `SELECT item_id,
                SUM(CASE WHEN action_type = 'saida' THEN quantity ELSE -quantity END) AS quantity
         FROM other_item_event_movements
         WHERE event_id = ?
         GROUP BY item_id
         HAVING quantity > 0`,
        [eventId]
    );

    for (const itemMovement of otherItemsInEvent) {
        await execute(
            env,
            'UPDATE other_items SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [itemMovement.quantity, itemMovement.item_id]
        );
    }

    await execute(env, 'DELETE FROM other_item_event_movements WHERE event_id = ?', [eventId]);
    await execute(env, 'DELETE FROM cable_event_movements WHERE event_id = ?', [eventId]);
    await execute(env, 'DELETE FROM equipment_events WHERE event_id = ?', [eventId]);
    await execute(env, 'DELETE FROM events WHERE id = ?', [eventId]);
}

async function ensureSaidaHiddenItemsTable(env) {
    await execute(
        env,
        `CREATE TABLE IF NOT EXISTS event_saida_hidden_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            item_type TEXT NOT NULL CHECK(item_type IN ('equipment', 'cable', 'other')),
            item_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(event_id, item_type, item_id)
        )`
    );
}

async function queryAll(env, sql, params = []) {
    const result = await env.DB.prepare(sql).bind(...params).run();
    return result.results || [];
}

async function queryFirst(env, sql, params = []) {
    return env.DB.prepare(sql).bind(...params).first();
}

async function execute(env, sql, params = []) {
    return env.DB.prepare(sql).bind(...params).run();
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...extraHeaders
        }
    });
}

function parseCookies(cookieHeader) {
    return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const index = part.indexOf('=');
            if (index === -1) return acc;
            const key = part.slice(0, index);
            const value = part.slice(index + 1);
            acc[key] = value;
            return acc;
        }, {});
}

function toBase64Url(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toSqliteDate(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function isAvailableStatus(status) {
    const normalized = String(status || '').toLowerCase();
    return !normalized
        || normalized === 'disponivel'
        || normalized === 'disponível'
        || normalized === 'pre separado'
        || normalized === 'relacao'
        || normalized === 'relação';
}

function handleDatabaseError(error, duplicateMessage) {
    const message = String(error?.message || error || '');
    if (message.toLowerCase().includes('unique')) {
        return json({ error: duplicateMessage }, 409);
    }

    console.error('Database error:', error);
    return json({ error: message || 'Erro no banco de dados' }, 500);
}
