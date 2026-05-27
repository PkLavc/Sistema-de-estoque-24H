-- Sample data for the test/guest account (convidado)
-- All records have company_id = NULL so they are visible to the test user (gestor_admin role)
-- Uses INSERT … SELECT … WHERE NOT EXISTS to be idempotent (safe to re-run)

-- ── Equipments ────────────────────────────────────────────────────────────────
INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Caixa de Som JBL 15"', 'DEMO-EQ-001', 'Disponivel', 'Som'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-001');

INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Mesa de Som Yamaha 24ch', 'DEMO-EQ-002', 'Disponivel', 'Som'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-002');

INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Microfone Shure SM58', 'DEMO-EQ-003', 'Indisponivel', 'Som'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-003');

INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Projetor Epson 5000lm', 'DEMO-EQ-004', 'Indisponivel', 'Vídeo'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-004');

INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Moving Head LED 150W', 'DEMO-EQ-005', 'Disponivel', 'Iluminação'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-005');

INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Par LED RGBW 54 Cores', 'DEMO-EQ-006', 'Disponivel', 'Iluminação'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-006');

INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Tripé de Caixa', 'DEMO-EQ-007', 'Em manutencao', 'Som'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-007');

INSERT INTO equipments (name, barcode, current_status, category)
SELECT 'Mesa DJ Pioneer XDJ-RX', 'DEMO-EQ-008', 'Disponivel', 'Som'
WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE barcode = 'DEMO-EQ-008');

-- ── Cables ────────────────────────────────────────────────────────────────────
-- available_quantity already accounts for the movements inserted below
INSERT INTO cables (name, quantity, available_quantity, category)
SELECT 'Cabo XLR M/F 5m', 20, 12, 'Áudio'
WHERE NOT EXISTS (SELECT 1 FROM cables WHERE name = 'Cabo XLR M/F 5m');

INSERT INTO cables (name, quantity, available_quantity, category)
SELECT 'Cabo P10-P10 3m', 15, 11, 'Áudio'
WHERE NOT EXISTS (SELECT 1 FROM cables WHERE name = 'Cabo P10-P10 3m');

INSERT INTO cables (name, quantity, available_quantity, category)
SELECT 'Cabo HDMI 5m', 8, 7, 'Vídeo'
WHERE NOT EXISTS (SELECT 1 FROM cables WHERE name = 'Cabo HDMI 5m');

INSERT INTO cables (name, quantity, available_quantity, category)
SELECT 'Cabo de Força 3m', 30, 20, 'Elétrico'
WHERE NOT EXISTS (SELECT 1 FROM cables WHERE name = 'Cabo de Força 3m');

INSERT INTO cables (name, quantity, available_quantity, category)
SELECT 'Cabo de Rede Cat6 10m', 10, 10, 'Rede'
WHERE NOT EXISTS (SELECT 1 FROM cables WHERE name = 'Cabo de Rede Cat6 10m');

INSERT INTO cables (name, quantity, available_quantity, category)
SELECT 'Cabo Speakon 10m', 12, 10, 'Áudio'
WHERE NOT EXISTS (SELECT 1 FROM cables WHERE name = 'Cabo Speakon 10m');

-- ── Events ────────────────────────────────────────────────────────────────────
INSERT INTO events (name, date, event_type, created_by_username)
SELECT 'Show da Banda Metallix', '2026-06-15', 'event', 'teste'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE name = 'Show da Banda Metallix');

INSERT INTO events (name, date, event_type, created_by_username, withdrawal_date, return_date)
SELECT 'Casamento Fernanda & Lucas', '2026-06-22', 'rental', 'teste', '2026-06-21', '2026-06-23'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE name = 'Casamento Fernanda & Lucas');

INSERT INTO events (name, date, event_type, created_by_username)
SELECT 'Festival de Verão 2026', '2026-07-04', 'event', 'teste'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE name = 'Festival de Verão 2026');

-- ── Equipment movements ───────────────────────────────────────────────────────
INSERT INTO equipment_events (equipment_id, event_id, action_type, performed_by_username, created_at)
SELECT eq.id, ev.id, 'saida', 'teste', CURRENT_TIMESTAMP
FROM equipments eq JOIN events ev ON ev.name = 'Show da Banda Metallix'
WHERE eq.barcode = 'DEMO-EQ-003'
  AND NOT EXISTS (
      SELECT 1 FROM equipment_events
      WHERE equipment_id = eq.id AND event_id = ev.id AND action_type = 'saida'
  );

INSERT INTO equipment_events (equipment_id, event_id, action_type, performed_by_username, created_at)
SELECT eq.id, ev.id, 'saida', 'teste', CURRENT_TIMESTAMP
FROM equipments eq JOIN events ev ON ev.name = 'Casamento Fernanda & Lucas'
WHERE eq.barcode = 'DEMO-EQ-004'
  AND NOT EXISTS (
      SELECT 1 FROM equipment_events
      WHERE equipment_id = eq.id AND event_id = ev.id AND action_type = 'saida'
  );

-- ── Cable movements ───────────────────────────────────────────────────────────
-- Show da Banda Metallix
INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity, created_at)
SELECT c.id, ev.id, 'saida', 8, CURRENT_TIMESTAMP
FROM cables c JOIN events ev ON ev.name = 'Show da Banda Metallix'
WHERE c.name = 'Cabo XLR M/F 5m'
  AND NOT EXISTS (
      SELECT 1 FROM cable_event_movements
      WHERE cable_id = c.id AND event_id = ev.id AND action_type = 'saida'
  );

INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity, created_at)
SELECT c.id, ev.id, 'saida', 4, CURRENT_TIMESTAMP
FROM cables c JOIN events ev ON ev.name = 'Show da Banda Metallix'
WHERE c.name = 'Cabo P10-P10 3m'
  AND NOT EXISTS (
      SELECT 1 FROM cable_event_movements
      WHERE cable_id = c.id AND event_id = ev.id AND action_type = 'saida'
  );

INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity, created_at)
SELECT c.id, ev.id, 'saida', 8, CURRENT_TIMESTAMP
FROM cables c JOIN events ev ON ev.name = 'Show da Banda Metallix'
WHERE c.name = 'Cabo de Força 3m'
  AND NOT EXISTS (
      SELECT 1 FROM cable_event_movements
      WHERE cable_id = c.id AND event_id = ev.id AND action_type = 'saida'
  );

INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity, created_at)
SELECT c.id, ev.id, 'saida', 2, CURRENT_TIMESTAMP
FROM cables c JOIN events ev ON ev.name = 'Show da Banda Metallix'
WHERE c.name = 'Cabo Speakon 10m'
  AND NOT EXISTS (
      SELECT 1 FROM cable_event_movements
      WHERE cable_id = c.id AND event_id = ev.id AND action_type = 'saida'
  );

-- Casamento Fernanda & Lucas
INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity, created_at)
SELECT c.id, ev.id, 'saida', 1, CURRENT_TIMESTAMP
FROM cables c JOIN events ev ON ev.name = 'Casamento Fernanda & Lucas'
WHERE c.name = 'Cabo HDMI 5m'
  AND NOT EXISTS (
      SELECT 1 FROM cable_event_movements
      WHERE cable_id = c.id AND event_id = ev.id AND action_type = 'saida'
  );

INSERT INTO cable_event_movements (cable_id, event_id, action_type, quantity, created_at)
SELECT c.id, ev.id, 'saida', 2, CURRENT_TIMESTAMP
FROM cables c JOIN events ev ON ev.name = 'Casamento Fernanda & Lucas'
WHERE c.name = 'Cabo de Força 3m'
  AND NOT EXISTS (
      SELECT 1 FROM cable_event_movements
      WHERE cable_id = c.id AND event_id = ev.id AND action_type = 'saida'
  );

-- ── Maintenance ───────────────────────────────────────────────────────────────
INSERT INTO maintenances (equipment_id, description, created_at)
SELECT id, 'Parafuso de travamento quebrado — aguardando peça de reposição', CURRENT_TIMESTAMP
FROM equipments
WHERE barcode = 'DEMO-EQ-007'
  AND NOT EXISTS (
      SELECT 1 FROM maintenances m
      JOIN equipments eq2 ON eq2.id = m.equipment_id
      WHERE eq2.barcode = 'DEMO-EQ-007' AND m.resolved_at IS NULL
  );
