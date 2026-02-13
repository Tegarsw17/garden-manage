'use client'

import { useEffect, useState } from 'react'
import { Calendar, Edit, Trash2, Share2, X, Plus, Mic, Camera, ChevronDown } from 'lucide-react'
import { supabase, type GardenUpdate, type Garden, type Plant, type Condition, getGardens, getPlants, getPlantsByGarden, getUpdates, getConditions, createUpdate, updateUpdate, deleteUpdate, uploadMediaArray } from '@/lib/supabase'
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

  // Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedUpdate, setSelectedUpdate] = useState<GardenUpdate | null>(null)

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [activeGarden, setActiveGarden] = useState<Garden | null>(null)
  const [formData, setFormData] = useState({
    type: '',
    plantId: '',
    desc: '',
    conditionIds: [] as number[],
  })
  const [mediaFiles, setMediaFiles] = useState<{ data: string; type: string }[]>([])
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })

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

  // Detail modal handlers
  const openDetailModal = (update: GardenUpdate) => {
    setSelectedUpdate(update)
    setIsDetailModalOpen(true)
  }

  const closeDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedUpdate(null)
  }

  // Edit modal handlers
  const openEditModal = (update: GardenUpdate) => {
    setIsEditing(true)
    setEditId(update.id || null)

    // Find the garden
    const garden = gardens.find(g => g.name === update.garden)
    setActiveGarden(garden || null)

    // Find the plant by name
    const plant = plants.find(p => p.plantName === update.plantId)

    // Handle media - can be string (old) or array (new from migration)
    const existingMediaUrls = Array.isArray(update.media) ? update.media : (update.media ? [update.media] : [])
    const existingMediaTypes = Array.isArray(update.mediaType) ? update.mediaType : (update.mediaType ? [update.mediaType] : [])

    // Load files from existing media URLs
    const loadedFiles: { data: string; type: string }[] = []
    existingMediaUrls.forEach((url, i) => {
      if (url && url.startsWith && !url.startsWith('data:') && !url.startsWith('blob:')) {
        const type = existingMediaTypes[i] || 'image/jpeg'
        loadedFiles.push({ data: url, type })
      }
    })

    setFormData({
      type: update.type,
      plantId: plant?.id?.toString() || '',
      desc: update.desc,
      conditionIds: update.conditionIds || [],
    })
    setMediaFiles(loadedFiles)
    setIsDetailModalOpen(false)
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setIsEditing(false)
    setEditId(null)
    setFormData({ type: '', plantId: '', desc: '', conditionIds: [] })
    setMediaFiles([])
    setActiveGarden(null)
  }

  // Form submission
  const handleSubmit = async () => {
    if (!activeGarden || !formData.plantId || !formData.desc) {
      setToast({ show: true, message: 'Please fill in all required fields' })
      setTimeout(() => setToast({ show: false, message: '' }), 3000)
      return
    }

    // Find the selected plant
    const selectedPlant = plants.find(p => p.id === Number(formData.plantId))
    if (!selectedPlant) return

    // Upload media files if present
    const uploadedMediaUrls: string[] = []
    const uploadedMediaTypes: string[] = []

    for (const mediaFile of mediaFiles) {
      if (mediaFile.data && mediaFile.data.startsWith('data:')) {
        // Convert data URL to blob and upload to Supabase
        try {
          const base64Data = mediaFile.data.split(',')[1]
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: mediaFile.type })
          const file = new File([blob], `media.${mediaFile.type.split('/')[1]}`, { type: mediaFile.type })

          const uploadedUrls = await uploadMediaArray([file])
          if (uploadedUrls.length > 0) {
            uploadedMediaUrls.push(uploadedUrls[0])
            uploadedMediaTypes.push(mediaFile.type)
          }
        } catch (error) {
          console.error('Upload error:', error)
        }
      } else if (mediaFile.data && !mediaFile.data.startsWith('data:')) {
        // Existing URL - preserve it
        uploadedMediaUrls.push(mediaFile.data)
        uploadedMediaTypes.push(mediaFile.type)
      }
    }

    const updateData: GardenUpdate = {
      garden: activeGarden.name,
      type: selectedPlant.plantTypeName || '',
      plantId: selectedPlant.plantName,
      desc: formData.desc,
      media: uploadedMediaUrls,
      mediaType: uploadedMediaTypes,
      conditionIds: formData.conditionIds,
      date: new Date().toLocaleString(),
    }

    if (isEditing && editId) {
      await updateUpdate(editId, updateData)
      setToast({ show: true, message: 'Report updated!' })
    } else {
      await createUpdate(updateData)
      setToast({ show: true, message: 'Report created!' })
    }

    // Reload updates
    const updatesData = await getUpdates()
    setUpdates(updatesData)
    closeEditModal()
  }

  const handleDelete = async (id: number) => {
    if (confirm('Delete this report?')) {
      await deleteUpdate(id)
      const updatesData = await getUpdates()
      setUpdates(updatesData)
      setToast({ show: true, message: 'Report deleted!' })
      closeDetailModal()
    }
    setTimeout(() => setToast({ show: false, message: '' }), 3000)
  }

  const handleMediaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      // Read all files and wait for them to complete
      const filePromises = files.map(file => {
        return new Promise<{ data: string; type: string }>((resolve) => {
          const reader = new FileReader()
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string
            resolve({ data: dataUrl, type: file.type })
          }
          reader.onerror = () => {
            console.error('Error reading file:', file.name)
            resolve({ data: '', type: file.type })
          }
          reader.readAsDataURL(file)
        })
      })

      const newFiles = await Promise.all(filePromises)
      setMediaFiles(prev => [...prev, ...newFiles.filter(f => f.data !== '')])
    }
  }

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }

  const toggleCondition = (conditionId: number) => {
    setFormData(prev => {
      const currentIds = prev.conditionIds || []
      if (currentIds.includes(conditionId)) {
        return { ...prev, conditionIds: currentIds.filter(id => id !== conditionId) }
      } else {
        return { ...prev, conditionIds: [...currentIds, conditionId] }
      }
    })
  }

  const shareToWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const shareSingle = (update: GardenUpdate) => {
    const mediaText = Array.isArray(update.media) ? update.media.join('\n') : (update.media || '')
    const text = `*Garden Report*\n\n🌱 *Garden:* ${update.garden}\n🌿 *Plant:* ${update.type} (${update.plantId})\n📝 *Note:* ${update.desc}${mediaText ? `\n\n${mediaText}` : ''}`
    shareToWhatsApp(text)
  }

  // Helper function to render media carousel in detail modal
  const renderMediaCarousel = (media: string | string[], mediaType?: string | string[]) => {
    const mediaUrls = Array.isArray(media) ? media : (media ? [media] : [])
    const mediaTypes = Array.isArray(mediaType) ? mediaType : (mediaType ? [mediaType] : [])

    if (mediaUrls.length === 0) return null

    // Only one media item
    if (mediaUrls.length === 1) {
      const mediaUrl = mediaUrls[0]
      const typeValue = mediaTypes[0]

      if (!mediaUrl) return null

      const isVideo = typeof typeValue === 'string' && typeValue.startsWith('video')
      if (isVideo) {
        return <video controls src={mediaUrl} className="w-full h-auto max-h-[500px] object-contain rounded-lg bg-black" />
      }
      return <img src={mediaUrl} alt="Media" className="w-full h-auto max-h-[500px] object-contain rounded-lg" />
    }

    // Multiple media items - use carousel
    return <MediaCarousel mediaUrls={mediaUrls} mediaTypes={mediaTypes} />
  }

  // Media Carousel Component
  function MediaCarousel({ mediaUrls, mediaTypes }: { mediaUrls: string[], mediaTypes: (string | undefined)[] }) {
    const [currentIndex, setCurrentIndex] = useState(0)

    const goToPrevious = () => {
      setCurrentIndex((prevIndex) => (prevIndex === 0 ? mediaUrls.length - 1 : prevIndex - 1))
    }

    const goToNext = () => {
      setCurrentIndex((prevIndex) => (prevIndex === mediaUrls.length - 1 ? 0 : prevIndex + 1))
    }

    const currentUrl = mediaUrls[currentIndex]
    const currentType = mediaTypes[currentIndex]
    const isVideo = typeof currentType === 'string' && currentType.startsWith('video')

    return (
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        <div className="flex items-center justify-center min-h-[300px]">
          {isVideo ? (
            <video
              key={currentIndex}
              controls
              src={currentUrl}
              className="w-full h-auto max-h-[500px] object-contain"
            />
          ) : (
            <img
              key={currentIndex}
              src={currentUrl}
              alt={`Media ${currentIndex + 1}`}
              className="w-full h-auto max-h-[500px] object-contain"
            />
          )}
        </div>

        {/* Navigation buttons */}
        {mediaUrls.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
              aria-label="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
              aria-label="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}

        {/* Indicators */}
        {mediaUrls.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {mediaUrls.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white w-8' : 'bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Counter */}
        {mediaUrls.length > 1 && (
          <div className="absolute top-4 right-4 bg-black/50 text-white text-sm font-medium px-3 py-1.5 rounded-full">
            {currentIndex + 1} / {mediaUrls.length}
          </div>
        )}
      </div>
    )
  }

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
                  <tr
                    key={update.id}
                    onClick={() => openDetailModal(update)}
                    className="border-b text-sm border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
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
                      {update.media && update.media.length > 0 && update.media[0] ? (
                        <div className="w-16 h-16">
                          {Array.isArray(update.media) ? (
                            <>
                              {update.media.length > 1 ? (
                                <div className="relative w-full h-full">
                                  <img src={update.media[0]} alt="Media" className="w-full h-full object-cover rounded" />
                                  <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-tl rounded-br">
                                    +{update.media.length - 1}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {update.mediaType?.[0]?.startsWith?.('video') ? (
                                    <video src={update.media[0]} className="w-full h-full object-cover rounded" controls />
                                  ) : (
                                    <img src={update.media[0]} alt="Media" className="w-full h-full object-cover rounded" />
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {update.mediaType?.[0]?.startsWith?.('video') ? (
                                <video src={update.media} className="w-full h-full object-cover rounded" controls />
                              ) : (
                                <img src={update.media} alt="Media" className="w-full h-full object-cover rounded" />
                              )}
                            </>
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

      {/* Detail Modal */}
      {isDetailModalOpen && selectedUpdate && (
        <div
          className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center p-0 md:items-center md:p-4"
          onClick={(e) => e.target === e.currentTarget && closeDetailModal()}
        >
          <div className="bg-white w-full max-w-2xl rounded-t-2xl md:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-block bg-green-100 text-green-900 font-bold px-3 py-1.5 rounded-lg text-sm">
                    {selectedUpdate.type}
                  </span>
                  {selectedUpdate.conditionIds && selectedUpdate.conditionIds.map(conditionId => {
                    const condition = conditions.find(c => c.id === conditionId)
                    return condition ? (
                      <span
                        key={condition.id}
                        className="inline-block font-bold px-3 py-1.5 rounded-lg text-sm"
                        style={{ backgroundColor: condition.color + '20', color: condition.color }}
                      >
                        {condition.icon}
                        <span className="hidden md:inline">{condition.name}</span>
                      </span>
                    ) : null
                  })}
                </div>
                <h2 className="text-xl text-black font-semibold">{selectedUpdate.plantId}</h2>
              </div>
              <button
                onClick={closeDetailModal}
                className="text-gray-500 hover:text-red-600 text-3xl transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Garden info */}
              <div className="text-sm text-gray-500 pb-3 border-b border-gray-100">
                <strong>{selectedUpdate.garden}</strong> • 📅 {formatDate(selectedUpdate.date)}
              </div>

              {/* Media */}
              {selectedUpdate.media && (
                <div className="rounded-lg overflow-hidden">
                  {renderMediaCarousel(selectedUpdate.media, selectedUpdate.mediaType)}
                </div>
              )}

              {/* Description */}
              <div>
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-2">Description</h3>
                <p className="text-gray-800 whitespace-pre-wrap text-base leading-relaxed bg-gray-50 p-4 rounded-lg">
                  {selectedUpdate.desc}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    shareSingle(selectedUpdate)
                    closeDetailModal()
                  }}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-all"
                >
                  <Share2 size={18} /> Share
                </button>
                <button
                  onClick={() => openEditModal(selectedUpdate)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                >
                  <Edit size={18} /> Edit
                </button>
                <button
                  onClick={() => selectedUpdate.id && handleDelete(selectedUpdate.id)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-all"
                >
                  <Trash2 size={18} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[310] flex items-end justify-center p-0 md:items-center md:p-4"
          onClick={(e) => e.target === e.currentTarget && closeEditModal()}
        >
          <div className="bg-white w-full max-w-2xl rounded-t-2xl md:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h2 className="text-2xl font-bold text-green-700">{isEditing ? 'Edit Report' : 'New Report'}</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-500 hover:text-red-600 text-3xl transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Plant Selection */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Plant <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.plantId}
                  onChange={(e) => setFormData(prev => ({ ...prev, plantId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black bg-white focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  required
                >
                  <option value="">Select a plant</option>
                  {plants.map(plant => (
                    <option key={plant.id} value={plant.id?.toString() || ''}>
                      {plant.plantName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Description <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={formData.desc}
                  onChange={(e) => setFormData(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="Enter observation notes..."
                  className="w-full px-4 py-3 border text-black border-gray-300 rounded-lg bg-white focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  rows={4}
                  required
                />
              </div>

              {/* Conditions */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Conditions
                </label>
                <div className="flex flex-wrap gap-2">
                  {conditions.map(condition => (
                    <button
                      key={condition.id}
                      type="button"
                      onClick={() => condition.id !== undefined && toggleCondition(condition.id)}
                      className={`px-3 py-2 rounded-lg font-semibold transition-all ${
                        (formData.conditionIds || []).includes(condition.id!)
                          ? 'ring-2 ring-offset-2'
                          : 'opacity-50 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: condition.color + '20',
                        color: condition.color,
                      } as React.CSSProperties}
                    >
                      {condition.icon} {condition.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Optional - Select one or more conditions</p>
              </div>

              {/* Media */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Photos / Videos
                </label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <label className="block w-full py-3 text-center bg-white border border-green-700 text-green-700 rounded-lg font-semibold cursor-pointer hover:bg-green-50 transition-all">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleMediaFileSelect}
                      className="hidden"
                    />
                    📸 Upload from Camera
                  </label>
                  {mediaFiles.length > 0 && (
                    <div className="mt-2 text-sm font-semibold text-gray-600">
                      {mediaFiles.length} file{mediaFiles.length === 1 ? '' : 's'} selected
                    </div>
                  )}
                </div>

                {/* Media Previews */}
                {mediaFiles.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {mediaFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.type?.startsWith('video') ? (
                          <video src={file.data} controls className="w-full h-24 object-cover rounded-lg" />
                        ) : (
                          <img src={file.data} alt={`Preview ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeMediaFile(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 mt-2 text-center">
                    No media selected
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-4 border-none rounded-lg text-lg font-semibold text-white bg-green-700 hover:bg-green-800 hover:-translate-y-0.5 transition-all"
                >
                  {isEditing ? 'Update Report' : 'Save Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-[400]">
          {toast.message}
        </div>
      )}
    </div>
  )
}
