import React, { createContext, useContext, useMemo, useState } from 'react'

type Filters = {
    selectedCourses: string[]
    setSelectedCourses: (ids: string[]) => void
    showTypes: { canvas: boolean, session: boolean, task: boolean }
    setShowTypes: (s: Filters['showTypes']) => void
}

const Ctx = createContext<Filters | null>(null)

export function CalendarFiltersProvider({ children }: { children: React.ReactNode }) {
    const [selectedCourses, setSelectedCourses] = useState<string[]>([])
    const [showTypes, setShowTypes] = useState({ canvas: true, session: true, task: true })
    const value = useMemo(() => ({ selectedCourses, setSelectedCourses, showTypes, setShowTypes }), [selectedCourses, showTypes])
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCalendarFilters() {
    const v = useContext(Ctx)
    if (!v) throw new Error('useCalendarFilters must be used within CalendarFiltersProvider')
    return v
}


