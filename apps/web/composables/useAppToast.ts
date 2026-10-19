import { createToastManager } from 'reka-ui'
import { useI18n } from 'vue-i18n'

export type ToastStatus = 'success' | 'warning' | 'danger' | 'info'

export interface ToastAction {
    label: string
    /** Screen-reader description, because the toast closes on its own. */
    altText: string
    onClick: (event: MouseEvent) => void
}

export interface ToastContent {
    title: string
    description?: string
    action?: ToastAction
    className?: string
    duration?: number
}

/** Options for a call site that already has one sentence and wants the status title. */
export interface ToastSentenceOptions {
    title?: string
    action?: ToastAction
    className?: string
    duration?: number
}

export interface AppToastData {
    className?: string
}

export interface AppToast {
    show: (status: ToastStatus, content: ToastContent | string, options?: ToastSentenceOptions) => string
    success: (content: ToastContent | string, options?: ToastSentenceOptions) => string
    warning: (content: ToastContent | string, options?: ToastSentenceOptions) => string
    danger: (content: ToastContent | string, options?: ToastSentenceOptions) => string
    error: (content: ToastContent | string, options?: ToastSentenceOptions) => string
    info: (content: ToastContent | string, options?: ToastSentenceOptions) => string
    dismiss: (id?: string) => void
}

/** Short enough to leave, long enough to read one sentence. Hover pauses it. */
export const TOAST_DURATION_MS = 5000

const STATUS_TITLE_KEY: Record<ToastStatus, string> = {
    success: 'toast.successTitle',
    warning: 'toast.warningTitle',
    danger: 'toast.dangerTitle',
    info: 'toast.infoTitle'
}

/*
 * One manager for the whole app. It holds no toast list of its own, so creating
 * it at module scope is safe during SSR. A toast fired before the viewport
 * mounts waits on the client and is dropped on the server.
 */
export const appToastManager = createToastManager<AppToastData>()

export function toastStatusTitleKey(status: string | undefined): string | undefined {
    if (status === 'success' || status === 'warning' || status === 'danger' || status === 'info') {
        return STATUS_TITLE_KEY[status]
    }
    return undefined
}

function isToastContent(value: ToastContent | string): value is ToastContent {
    return typeof value !== 'string'
}

function publish(
    status: ToastStatus,
    content: ToastContent | string,
    translate: (key: string) => string,
    options?: ToastSentenceOptions
): string {
    const resolved: ToastContent = isToastContent(content)
        ? content
        : {
            title: options?.title ?? translate(STATUS_TITLE_KEY[status]),
            description: content,
            action: options?.action,
            className: options?.className,
            duration: options?.duration
        }

    return appToastManager.add({
        title: resolved.title,
        description: resolved.description,
        status,
        // These toasts answer something the user just did, so announce them immediately.
        type: 'foreground',
        duration: resolved.duration ?? TOAST_DURATION_MS,
        actionProps: resolved.action
            ? {
                label: resolved.action.label,
                altText: resolved.action.altText,
                onClick: resolved.action.onClick
            }
            : undefined,
        data: resolved.className ? { className: resolved.className } : undefined
    })
}

export function useAppToast(): AppToast {
    const { t } = useI18n()
    const translate = (key: string) => t(key)

    function show(status: ToastStatus, content: ToastContent | string, options?: ToastSentenceOptions) {
        return publish(status, content, translate, options)
    }

    return {
        show,
        success: (content, options) => show('success', content, options),
        warning: (content, options) => show('warning', content, options),
        danger: (content, options) => show('danger', content, options),
        // Existing call sites say "error". The status colour is danger.
        error: (content, options) => show('danger', content, options),
        info: (content, options) => show('info', content, options),
        dismiss: id => {
            appToastManager.close(id)
        }
    }
}
