"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

interface ThemeProviderProps extends React.ComponentProps<typeof NextThemesProvider> {
    /** Storage key for the theme preference. Allows isolation per user/role. */
    storageKey?: string;
}

export function ThemeProvider({
    children,
    storageKey = "theme",
    ...props
}: ThemeProviderProps) {
    return (
        <NextThemesProvider storageKey={storageKey} {...props}>
            {children}
        </NextThemesProvider>
    )
}
