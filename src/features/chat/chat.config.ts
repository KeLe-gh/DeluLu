export const chatEnabled =
    import.meta.env.MODE === 'development' ||
    import.meta.env.VITE_ENABLE_CHAT === 'true'

export const pushEnabled =
    chatEnabled &&
    import.meta.env.VITE_ENABLE_PUSH === 'true'