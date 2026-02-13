'use client'

import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import { supabase, type GardenUpdate, type Garden, type Plant, type Condition, getGardens, getPlants, getUpdates, getConditions } from '@/lib/supabase'
import Link from 'next/link'

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DashboardPage() {
  // State
  const [gardens, setGardens] = useState<Garden[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [updates, setUpdates] = useState<GardenUpdate[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<'date' | 'plantName' | 'garden' | 'condition'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Filters
  const [filters, setFilters] = useState({
    gardenId: 'all',
    plantId: 'all',
    conditionId: 'all',
  })

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      const [gardensData, plantsData, updatesData, conditionsData] = await Promise.all([
        getGardens(),
        getPlants(),
        getUpdates(),
        getConditions(true),
      ])
      setGardens(gardensData)
      setPlants(plantsData)
      setUpdates(updatesData)
      setConditions(conditionsData)
      setIsLoading(false)
    }

    loadData()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // Apply filters and sorting
  const filteredUpdates = updates.filter(update => {
    // Filter by Garden
    if (filters.gardenId !== 'all') {
      const selectedGarden = gardens.find(g => g.id === Number(filters.gardenId))
      if (!selectedGarden || update.garden !== selectedGarden.name) {
        return false
      }
    }

    // Filter by Plant
    if (filters.plantId !== 'all' && update.plantId !== filters.plantId) {
      return false
    }

    // Filter by Condition (convert string to number for comparison)
    if (filters.conditionId !== 'all') {
      const conditionIdNum = Number(filters.conditionId)
      if (!update.conditionIds?.includes(conditionIdNum)) {
        return false
      }
    }

    return true
  })

  // Apply sorting
  const sortedUpdates = [...filteredUpdates].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
        break
    case 'plantName':
        comparison = a.plantId.localeCompare(b.plantId)
        break
      case 'garden':
        comparison = a.garden.localeCompare(b.garden)
        break
      case 'condition':
        comparison = a.plantId.localeCompare(b.plantId)
        break
      default:
        comparison = a.plantId.localeCompare(b.plantId)
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Calculate pagination
  const totalPages = Math.ceil(sortedUpdates.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUpdates = sortedUpdates.slice(startIndex, endIndex)

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-green-700 text-white px-5 py-3 flex justify-between items-center h-[60px] shadow-lg">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            href="/"
            className="bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
          >
            Back
          </Link>
          <Link
            href="/conditions"
            className="bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
          >
            Manage Conditions
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-5 max-w-7xl mx-auto">
        {/* Filter Controls */}
        <div className="bg-white rounded-xl p-6 shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-green-700">Filter</h2>
            <button
              onClick={() => setFilters({ gardenId: 'all', plantId: 'all', conditionId: 'all' })}
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Garden Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-1">Garden</label>
              <select
                value={filters.gardenId}
                onChange={(e) => setFilters(prev => ({ ...prev, gardenId: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              >
                <option value="all">All Gardens</option>
                {gardens.map(garden => (
                  <option key={garden.id} value={garden.id}>{garden.name}</option>
                ))}
              </select>
            </div>

            {/* Plant Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-1">Plant</label>
              <select
                value={filters.plantId}
                onChange={(e) => setFilters(prev => ({ ...prev, plantId: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              >
                <option value="all">All Plants</option>
                {Array.from(new Set(updates.map(u => u.plantId))).sort().map(plantId => (
                  <option key={plantId} value={plantId}>{plantId}</option>
                ))}
              </select>
            </div>

            {/* Condition Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-1">Condition</label>
              <select
                value={filters.conditionId}
                onChange={(e) => setFilters(prev => ({ ...prev, conditionId: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              >
                <option value="all">All Conditions</option>
                {conditions.map(condition => (
                  <option key={condition.id} value={condition.id}>{condition.icon} {condition.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Plant</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Garden</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Conditions</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Media</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUpdates.map(update => (
                  <tr key={update.id} className="border-b text-sm border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{update.plantId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{update.garden}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {update.conditionIds?.map(conditionId => {
                          const condition = conditions.find(c => c.id === conditionId)
                          return condition ? (
                            <span
                              key={conditionId}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium"
                              style={{ backgroundColor: condition.color + '20', color: condition.color }}
                            >
                              {condition.icon} <span className="hidden md:inline">{condition.name}</span>
                            </span>
                          ) : null
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-black max-w-md truncate">{update.desc}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(update.date)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {update.media ? (
                        <div className="w-16 h-16">
                          {update.mediaType?.startsWith('video') ? (
                            <video src={update.media} className="w-full h-full object-cover rounded" controls />
                          ) : (
                            <img src={update.media} alt="Media" className="w-full h-full object-cover rounded" />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">No media</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-t border-gray-200 gap-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1}-{Math.min(endIndex, sortedUpdates.length)} of {sortedUpdates.length} reports
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first page, last page, and pages around current page
                      return page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)
                    })
                    .map((page, index, array) => {
                      // Add ellipsis if there's a gap
                      const prevPage = array[index - 1]
                      if (prevPage && page - prevPage > 1) {
                        return (
                          <span key={`ellipsis-${page}`} className="px-2 py-1.5 text-gray-400">
                            ...
                          </span>
                        )
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            currentPage === page
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
