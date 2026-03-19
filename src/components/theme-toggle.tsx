"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()

    return (
        <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative overflow-hidden group"
            aria-label="Toggle theme"
        >
            <Sun className="h-5 w-5 dark:hidden block transition-transform group-hover:rotate-12" />
            <Moon className="h-5 w-5 hidden dark:block transition-transform group-hover:-rotate-12" />
        </button>
    )
}
