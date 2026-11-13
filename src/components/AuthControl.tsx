import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { authStore } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { useManagementAccess } from '../hooks/useManagementAccess'
import './AuthControl.css'

export default function AuthControl({ onManage }: { onManage: () => void }) {
    const { user, ready, unavailable } = useAuth()
    const [open, setOpen] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const access = useManagementAccess(user?.id, menuOpen)
    const canManage = access && (access.is_admin || access.managed_club_ids.length > 0 || access.managed_project_ids.length > 0)
    const menuId = useId()
    const floating = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const menu = useRef<HTMLDivElement>(null)
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const dialog = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!open) return
        const previous = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialog.current?.querySelector<HTMLElement>('input, button')?.focus()
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
            if (event.key !== 'Tab') return
            const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]') ?? [])]
            const first = elements[0], last = elements[elements.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
        document.addEventListener('keydown', keyboard)
        return () => { document.removeEventListener('keydown', keyboard); document.body.style.overflow = overflow; previous?.focus() }
    }, [open])
    useEffect(() => {
        if (!menuOpen) return
        const focusFrame = window.requestAnimationFrame(() => {
            menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
        })
        const outside = (event: PointerEvent) => {
            if (!floating.current?.contains(event.target as Node)) setMenuOpen(false)
        }
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setMenuOpen(false); trigger.current?.focus() }
        }
        document.addEventListener('pointerdown', outside)
        document.addEventListener('keydown', escape)
        return () => {
            window.cancelAnimationFrame(focusFrame)
            document.removeEventListener('pointerdown', outside)
            document.removeEventListener('keydown', escape)
        }
    }, [menuOpen])
    function showDialog(nextMode?: 'login' | 'signup') {
        setMenuOpen(false)
        setError(null)
        if (nextMode) setMode(nextMode)
        trigger.current?.focus()
        setOpen(true)
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setError(null)
        if (mode === 'signup' && form.get('password') !== form.get('confirm_password')) { setError('Passwords do not match'); return }
        setBusy(true)
        try {
            await authStore.submit(mode, {
                email: String(form.get('email')), password: String(form.get('password')),
                ...(mode === 'signup' ? { full_name: String(form.get('full_name')), year_group_id: form.get('year') ? Number(form.get('year')) : null } : {}),
            })
            setOpen(false)
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to sign in. Please try again.') }
        finally { setBusy(false) }
    }
    async function logout(all: boolean) {
        setBusy(true); setError(null)
        try { await authStore.logout(all); setOpen(false); setMenuOpen(false); trigger.current?.focus() }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to sign out. Please try again.') }
        finally { setBusy(false) }
    }
    return <>
        <div className="auth-floating" ref={floating}
            onBlur={event => { if (!floating.current?.contains(event.relatedTarget as Node)) setMenuOpen(false) }}>
            <div id={menuId} ref={menu} className={`auth-menu${menuOpen ? ' is-open' : ''}`}
                role="menu" aria-label="Account options" aria-hidden={!menuOpen} inert={!menuOpen}
                onKeyDown={event => {
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const options = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
                    const index = options.indexOf(document.activeElement as HTMLButtonElement)
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
                        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
                    options[next]?.focus()
                }}>
                <div className="auth-menu-heading">
                    <span className="auth-menu-eyebrow">{user ? 'Signed in' : 'Account'}</span>
                    <strong>{user ? user.full_name : 'Welcome to the directory'}</strong>
                    {user && <span className="auth-menu-email">{user.email}</span>}
                </div>
                {error && !open && <p className="auth-menu-error" role="alert">{error}</p>}
                {unavailable && <p className="auth-menu-note">Account services are temporarily unavailable.</p>}
                <div className="auth-menu-options">
                    {user ? <>
                        {canManage && <button role="menuitem" onClick={() => { setMenuOpen(false); trigger.current?.focus(); onManage() }}>Manage listings<span aria-hidden="true">↗</span></button>}
                        <button role="menuitem" onClick={() => showDialog()}>Your account<span aria-hidden="true">↗</span></button>
                        <button role="menuitem" disabled={busy} onClick={() => { void logout(false) }}>{busy ? 'Signing out…' : 'Sign out'}<span aria-hidden="true">↗</span></button>
                        <button role="menuitem" className="auth-menu-secondary" disabled={busy} onClick={() => { void logout(true) }}>Sign out everywhere</button>
                    </> : <>
                        <button role="menuitem" onClick={() => showDialog('login')}>Sign in<span aria-hidden="true">↗</span></button>
                        <button role="menuitem" onClick={() => showDialog('signup')}>Create account<span aria-hidden="true">+</span></button>
                    </>}
                </div>
            </div>
            <button ref={trigger} className={`auth-fab${menuOpen ? ' is-open' : ''}`} type="button"
                aria-label="Account menu" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuId}
                title="Account" disabled={!ready || busy}
                onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setMenuOpen(true) } }}
                onClick={() => { setError(null); setMenuOpen(current => !current) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
                </svg>
            </button>
        </div>
        {open && <div className="auth-overlay" onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}>
            <div ref={dialog} className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-busy={busy}>
                <div className="auth-header">
                    <h2 id="auth-title">{user ? 'Your account' : mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
                    <button className="auth-close" aria-label="Close account dialog" onClick={() => setOpen(false)}>×</button>
                </div>
                {error && <p className="auth-error" role="alert">{error}</p>}
                {unavailable && !error && <p role="status">Account services are temporarily unavailable. You can still browse the directory.</p>}
                {user ? <div className="auth-account">
                    <p className="account-name">{user.full_name}</p><p>{user.email}</p>
                    {user.year_group_id && <p>Year {user.year_group_id}</p>}
                    <div className="auth-actions">
                        <button className="btn" disabled={busy} onClick={() => { void logout(false) }}>Sign out</button>
                        <button className="btn secondary" disabled={busy} onClick={() => { void logout(true) }}>Sign out everywhere</button>
                    </div>
                </div> : <>
                    <form key={mode} className="auth-form" onSubmit={event => { void submit(event) }}>
                        {mode === 'signup' && <label>Full name<input name="full_name" autoComplete="name" required maxLength={150} /></label>}
                        <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
                        <label>Password<input name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 12 : 1} maxLength={128} /></label>
                        {mode === 'signup' && <>
                            <p className="auth-hint">Use 12–128 characters. Spaces and password managers are welcome.</p>
                            <label>Confirm password<input name="confirm_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
                            <label>Year (optional)<select name="year" defaultValue=""><option value="">Prefer not to say</option>{[1,2,3,4].map(year => <option key={year} value={year}>Year {year}</option>)}</select></label>
                        </>}
                        <button className="btn" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
                    </form>
                    <button className="auth-switch" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}>
                        {mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}
                    </button>
                </>}
            </div>
        </div>}
    </>
}
