# Dual Deployment Strategy

This system supports two deployment modes with different authentication approaches.

## Deployment Targets

### 1. Cloudflare Deployment
- **Authentication**: Username/password via Cloudflare D1 database
- **Data Storage**: Cloudflare D1 database
- **Features**: Full multi-user system with persistent data
- **Access**: Regular users with accounts

### 2. GitHub Pages Deployment
- **Authentication**: Guest mode only (no backend available)
- **Data Storage**: Browser localStorage
- **Features**: Full functionality with local data storage
- **Access**: Anyone with the link (no login required for GitHub Pages, but login modal shown)

## How It Works

### Login Flow
The login page offers two options:
1. **Login**: For Cloudflare deployment with username/password
2. **Convidado (Guest)**: For GitHub Pages or offline usage

### Smart Authentication
- When deployed on Cloudflare: Server authentication works normally
- When deployed on GitHub Pages: Server authentication unavailable, falls back to localStorage guest mode
- Guest mode provides full functionality with data stored locally

## Configuration

### Cloudflare Setup
1. Deploy with Wrangler: `npm run deploy`
2. Configure D1 database
3. Set environment variables (SESSION_SECRET, etc.)
4. Users authenticate with database credentials

### GitHub Pages Setup
1. Push to main branch
2. GitHub Actions workflow deploys automatically
3. Users automatically use guest mode (localStorage)
4. No backend configuration needed

## Features in Guest Mode

Guest mode provides complete functionality:
- ✅ Create and manage events
- ✅ Add/edit equipment, cables, and other items
- ✅ Change colors and upload custom logo
- ✅ Create local "users" (stored in localStorage)
- ✅ Full inventory management
- ✅ Generate PDFs

**Important**: All data in guest mode is stored locally in the browser. Clearing browser data will delete everything.

## File Structure

After reorganization:
- `public/index.html` - Main dashboard (renamed from dashboard.html)
- `public/login/index.html` - Login page with dual-mode authentication
- `public/eventos/index.html` - Events page
- `public/entrada/index.html` - Equipment check-in
- `public/saida/index.html` - Equipment check-out

## Key Changes

### Removed
- ❌ Local admin credentials (adm/adm) - removed for security
- ❌ "Sistema de Controle" subtitle
- ❌ User status display below logo

### Added
- ✅ Dual authentication (server + localStorage)
- ✅ Automatic fallback for GitHub Pages
- ✅ Clean UI without unnecessary text
- ✅ Smart deployment detection

## For Developers

### Server Authentication (server.js)
- Removed hardcoded LOCAL_ADMIN credentials
- Guest login creates local session with `isGuest` flag
- `requireAdmin` middleware recognizes `localAuth` sessions

### Client Authentication (login.js)
- Tries server authentication first
- Falls back to localStorage for guest mode
- Seamless experience on both platforms

### Storage Layer (storage.js)
- Already implements dual-mode storage
- Guest mode uses localStorage with `guest_` prefix
- Server mode uses API calls

## Migration Notes

If upgrading from previous version:
1. Old "adm/adm" credentials no longer work
2. Create proper user accounts in database
3. Guest mode now handles offline usage
4. No breaking changes to data storage
