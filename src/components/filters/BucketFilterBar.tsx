import { type JSX, useState } from 'react'
import type { SizeFilter as SizeFilterType, DateFilter as DateFilterType } from '../../types/filters'
import { SizeFilter } from './SizeFilter'
import { DateFilter } from './DateFilter'
import { ActiveFilterBadges } from './ActiveFilterBadges'

interface BucketFilterBarProps {
    filterText: string
    onFilterTextChange: (text: string) => void
    sizeFilter: SizeFilterType
    dateFilter: DateFilterType
    onSizeFilterChange: (filter: SizeFilterType) => void
    onDateFilterChange: (filter: DateFilterType) => void
    onSizePresetChange: (preset: SizeFilterType['preset']) => void
    onCustomSizeRange: (minMB: number, maxMB: number | null) => void
    onDatePresetChange: (preset: DateFilterType['preset']) => void
    onCustomDateRange: (start: Date | null, end: Date | null) => void
    onClearAll: () => void
}

export function BucketFilterBar({
    filterText,
    onFilterTextChange,
    sizeFilter,
    dateFilter,
    onSizeFilterChange,
    onDateFilterChange,
    onSizePresetChange,
    onCustomSizeRange,
    onDatePresetChange,
    onCustomDateRange,
    onClearAll
}: BucketFilterBarProps): JSX.Element {
    const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false)
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false)

    const handleClearText = (): void => onFilterTextChange('')

    const handleClearSize = (): void => {
        onSizeFilterChange({ min: null, max: null, preset: 'all' })
        setSizeDropdownOpen(false)
    }

    const handleClearDate = (): void => {
        onDateFilterChange({ start: null, end: null, preset: 'all' })
        setDateDropdownOpen(false)
    }

    return (
        <div className="filter-bar">
            <div className="filter-controls">
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Filter buckets..."
                        value={filterText}
                        onChange={(e) => onFilterTextChange(e.target.value)}
                        className="bucket-input"
                        id="bucket-filter-text"
                        name="bucket-filter-text"
                        aria-label="Filter buckets by name"
                        style={{ maxWidth: '100%' }} // Override max-width if needed or relying on parent container
                    />
                </div>

                <div className="filters-group">
                    <div className="filter-dropdown-container">
                        <SizeFilter
                            sizeFilter={sizeFilter}
                            isOpen={sizeDropdownOpen}
                            onToggle={() => {
                                setSizeDropdownOpen(!sizeDropdownOpen)
                                setDateDropdownOpen(false)
                            }}
                            onPresetChange={(preset) => {
                                onSizePresetChange(preset)
                                if (preset !== 'custom') setSizeDropdownOpen(false)
                            }}
                            onCustomRange={(min, max) => {
                                onCustomSizeRange(min, max)
                                setSizeDropdownOpen(false)
                            }}
                            onClear={handleClearSize}
                        />
                    </div>

                    <div className="filter-dropdown-container">
                        <DateFilter
                            dateFilter={dateFilter}
                            isOpen={dateDropdownOpen}
                            onToggle={() => {
                                setDateDropdownOpen(!dateDropdownOpen)
                                setSizeDropdownOpen(false)
                            }}
                            onPresetChange={(preset) => {
                                onDatePresetChange(preset)
                                if (preset !== 'custom') setDateDropdownOpen(false)
                            }}
                            onCustomRange={(start, end) => {
                                onCustomDateRange(start, end)
                                setDateDropdownOpen(false)
                            }}
                            onClear={handleClearDate}
                        />
                    </div>
                </div>

            </div>

            <ActiveFilterBadges
                filterText={filterText}
                selectedExtensions={[]} // Not applicable for buckets
                sizeFilter={sizeFilter}
                dateFilter={dateFilter}
                onClearText={handleClearText}
                onClearExtensions={() => void 0} // No-op
                onClearSize={handleClearSize}
                onClearDate={handleClearDate}
                onClearAll={onClearAll}
            />
        </div >
    )
}
