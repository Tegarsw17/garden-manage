'use client'

import { useEffect, useState, useRef, MouseEvent } from 'react'
import { supabase, type GardenUpdate, type Garden, type Plant, type Condition, getGardens, getPlants, getPlantsByGarden, getUpdates, getConditions, createUpdate, updateUpdate, deleteUpdate, uploadMedia, uploadMediaArray } from '@/lib/supabase'
import { Share2, Edit, Trash2, Plus, X, Mic, Camera, Leaf, MoreVertical } from 'lucide-react'
import Link from 'next/link'

declare global {
  interface Window {
    jspdf: {
      jsPDF: any
    }
  }
}

export default function Home() {
  // State
  const [view, setView] = useState<'dashboard' | 'feed'>('dashboard')
  const [gardens, setGardens] = useState<Garden[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [activeGarden, setActiveGarden] = useState<Garden | null>(null)
  const [updates, setUpdates] = useState<GardenUpdate[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedUpdate, setSelectedUpdate] = useState<GardenUpdate | null>(null)
  const [conditions, setConditions] = useState<Condition[]>([])

  // Form state
  const [formData, setFormData] = useState({
    type: '',
    plantId: '',
    desc: '',
    conditionIds: [] as number[],
  })
  const [mediaFiles, setMediaFiles] = useState<{ data: string; type: string }[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Speech recognition
  const recognitionRef = useRef<any>(null)

  // Initialize speech recognition and load initial data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        // merekam kalimat panjang tnapa henti
        recognitionRef.current.continuous = false
        // teks muncul saat user masih bicara
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'id-ID'

        recognitionRef.current.onstart = () => setIsListening(true)
        recognitionRef.current.onend = () => setIsListening(false)
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setFormData(prev => ({
            ...prev,
            desc: prev.desc ? prev.desc + ' ' + transcript : transcript
          }))
        }
      }
    }

    // Load gardens, plants, and conditions on mount
    loadGardensAndPlants()
    loadConditions()
  }, [])

  // Load updates when active garden changes
  useEffect(() => {
    if (activeGarden) {
      loadUpdates()
      loadPlantsForGarden(activeGarden.id!)
    }
  }, [activeGarden])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.menu-container')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside as any)
    return () => document.removeEventListener('mousedown', handleClickOutside as any)
  }, [])

  const loadGardensAndPlants = async () => {
    const gardensData = await getGardens()
    const plantsData = await getPlants()
    setGardens(gardensData)
    setPlants(plantsData)
  }

  const loadConditions = async () => {
    const conditionsData = await getConditions(true) // Only active conditions
    setConditions(conditionsData)
  }

  const loadPlantsForGarden = async (gardenId: number) => {
    const plantsData = await getPlantsByGarden(gardenId)
    setPlants(plantsData)
  }

  const loadUpdates = async () => {
    if (!activeGarden) return
    setIsLoading(true)
    const data = await getUpdates(activeGarden.name)
    setUpdates(data)
    setIsLoading(false)
  }

  // Get plant types for the current garden
  const getAvailableTypes = () => {
    if (!activeGarden) return []
    const gardenPlantTypes = new Set(plants.filter(p => p.gardenId === activeGarden.id).map(p => p.plantTypeName))
    return Array.from(gardenPlantTypes)
  }

  // Get plants for selected type in current garden
  const getAvailablePlants = () => {
    if (!activeGarden || !formData.type) return []
    return plants.filter(p => p.gardenId === activeGarden.id && p.plantTypeName === formData.type)
  }

  // Navigation
  const enterGarden = (garden: Garden) => {
    setActiveGarden(garden)
    setView('feed')
  }

  const switchGarden = () => {
    setActiveGarden(null)
    setView('dashboard')
    setIsSelecting(false)
    setSelectedIds(new Set())
  }

  // Modal handlers
  const openModal = () => {
    setIsModalOpen(true)
    setFormData({ type: '', plantId: '', desc: '', conditionIds: [] })
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({ type: '', plantId: '', desc: '', conditionIds: [] })
    setMediaFiles([])
    setMediaUrls([])
    setIsEditing(false)
    setEditId(null)
  }

  // Form handlers
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'type') {
      setFormData(prev => ({ ...prev, plantId: '' }))
    }
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

  const toggleSpeech = () => {
    if (!recognitionRef.current) return
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start()
  }

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Submit handlers
  const handleSubmit = async (shouldClose: boolean) => {
    if (!activeGarden || !formData.plantId || !formData.desc || isSubmitting) return

    setIsSubmitting(true)

    try {
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
        showToast('Report updated!')
      } else {
        await createUpdate(updateData)
        showToast(`Saved for ${selectedPlant.plantName}`)
      }

      await loadUpdates()

      if (shouldClose) {
        closeModal()
      } else {
        setFormData(prev => ({ ...prev, plantId: '', desc: '', conditionIds: [] }))
        setMediaFiles([])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (update: GardenUpdate) => {
    setIsEditing(true)
    setEditId(update.id || null)

    // Find the plant by name (since update.plantId is the plant NAME, not ID)
    const plant = plants.find(p => p.plantName === update.plantId)

    // Handle media - can be string (old) or array (new from migration)
    const existingMediaUrls = Array.isArray(update.media) ? update.media : (update.media ? [update.media] : [])
    const existingMediaTypes = Array.isArray(update.mediaType) ? update.mediaType : (update.mediaType ? [update.mediaType] : [])

    // Load files from existing media URLs
    const loadedFiles: { data: string; type: string }[] = []
    existingMediaUrls.forEach((url, i) => {
      if (url && url.startsWith && !url.startsWith('data:') && !url.startsWith('blob:')) {
        // Use the first type or default to image/jpeg
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
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Delete this report?')) {
      await deleteUpdate(id)
      await loadUpdates()
      showToast('Report deleted.')
    }
  }

  // Detail modal handlers
  const openDetailModal = (update: GardenUpdate, e?: React.MouseEvent) => {
    // Prevent opening if clicking on action buttons
    if (e) {
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('.menu-container') || target.closest('input')) {
        return
      }
    }
    setSelectedUpdate(update)
    setIsDetailModalOpen(true)
  }

  const closeDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedUpdate(null)
  }

  // Selection mode
  const toggleSelectMode = () => {
    setIsSelecting(!isSelecting)
    setSelectedIds(new Set())
    setOpenMenuId(null) // Close any open menu
  }

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
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

  // Share functions
  const shareToWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const shareSingle = (update: GardenUpdate) => {
    const text = `*Garden Report*\n\n🌱 *Garden:* ${update.garden}\n🌿 *Plant:* ${update.type} (${update.plantId})\n📝 *Note:* ${update.desc}${update.media ? `\n\n${update.media}` : ''}`
    shareToWhatsApp(text)
  }

  const shareBulk = () => {
    if (selectedIds.size === 0) return
    const selectedUpdates = updates.filter(u => u.id && selectedIds.has(u.id))
    let text = `*Garden Bulk Report*\n\n`
    selectedUpdates.forEach((u, index) => {
      text += `*${index + 1}. ${u.plantId} (${u.garden})*\n🌿 Type: ${u.type}\n📝 Note: ${u.desc}\n\n`
    })
    shareToWhatsApp(text)
  }

  // PDF generation
  const downloadPDF = async () => {
    if (selectedIds.size === 0) {
      showToast('Please select at least one plant.')
      return
    }

    const selectedUpdates = updates.filter(u => u.id && selectedIds.has(u.id))

    try {
      const jsPDFConstructor = window.jspdf?.jsPDF
      if (!jsPDFConstructor) {
        alert('PDF Library not loaded. Please refresh the page.')
        return
      }

      const doc = new jsPDFConstructor()

      // Header
      doc.setFontSize(22)
      doc.setTextColor(46, 125, 50)
      doc.text('Garden Monitor Report', 14, 15)

      // Date
      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25)
      doc.setTextColor(0)

      // Prepare table data
      const tableColumn = ['No', 'Plant (ID)', 'Description']
      const tableRows = selectedUpdates.map((update, index) => [
        index + 1,
        `${update.plantId} (${update.garden})`,
        update.desc,
      ])

      // Generate table
      ;(doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 11, cellPadding: 4 },
        headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
      })

      // Save
      doc.save(`garden_report_${Date.now()}.pdf`)
      showToast('PDF Downloaded!')
    } catch (error) {
      console.error('PDF Error:', error)
      alert('An error occurred while generating PDF.')
    }
  }

  const showToast = (message: string) => {
    setToast({ show: true, message })
    setTimeout(() => setToast({ show: false, message: '' }), 3000)
  }

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Helper function to render media in card view (first image + badge)
  const renderMediaCard = (media: string | string[], mediaType?: string | string[]) => {
    // Normalize to array format
    const mediaUrls = Array.isArray(media) ? media : (media ? [media] : [])
    const mediaTypes = Array.isArray(mediaType) ? mediaType : (mediaType ? [mediaType] : [])

    // Don't render if no media URLs
    if (mediaUrls.length === 0) return null

    const mediaUrl = mediaUrls[0]
    const typeValue = mediaTypes[0]

    if (!mediaUrl) return null

    const isVideo = typeof typeValue === 'string' && typeValue.startsWith('video')
    return (
      <div className="relative">
        {isVideo ? (
          <video controls src={mediaUrl} className="w-full h-48 object-cover rounded-lg mt-3" />
        ) : (
          <img src={mediaUrl} alt="Media" className="w-full h-48 object-cover rounded-lg mt-3" />
        )}
        {mediaUrls.length > 1 && (
          <div className="absolute top-4 right-4 bg-blue-600 text-white text-sm font-bold px-2.5 py-1 rounded-full shadow-lg">
            +{mediaUrls.length - 1}
          </div>
        )}
      </div>
    )
  }

  // Helper function to render media carousel in detail modal
  const renderMediaCarousel = (media: string | string[], mediaType?: string | string[]) => {
    // Normalize to array format
    const mediaUrls = Array.isArray(media) ? media : (media ? [media] : [])
    const mediaTypes = Array.isArray(mediaType) ? mediaType : (mediaType ? [mediaType] : [])

    // Don't render if no media URLs
    if (mediaUrls.length === 0) return null

    // Only one media item, render it directly
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

  // Helper function to render media (for card view - uses renderMediaCard)
  const renderMedia = (media: string | string[], mediaType?: string | string[]) => {
    return renderMediaCard(media, mediaType)
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-green-700 text-white px-5 py-3 flex justify-between items-center h-[60px] shadow-lg">
        <h1 className="text-xl font-semibold flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {activeGarden?.name || 'GardenGuard Monitor'}
        </h1>
        <div className="flex gap-2">
          {!activeGarden && (
            <Link
              href="/plants"
              className="bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2"
            >
              <Leaf size={16} />
              Manage Plants
            </Link>
          )}
          {activeGarden && (
            <button
              onClick={switchGarden}
              className="bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            >
              Switch Garden
            </button>
          )}
          {activeGarden && !isSelecting && (
            <button
              onClick={toggleSelectMode}
              className="bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            >
              Select
            </button>
          )}
          {isSelecting && (
            <button
              onClick={toggleSelectMode}
              className="bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            >
              Cancel ({selectedIds.size})
            </button>
          )}
        </div>
      </header>

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <div className="p-5 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {gardens.map(garden => {
              const gardenPlants = plants.filter(p => p.gardenId === garden.id)
              return (
                <div
                  key={garden.id}
                  onClick={() => enterGarden(garden)}
                  className="bg-white rounded-2xl p-10 text-center shadow-md cursor-pointer border-2 border-transparent hover:border-green-400 hover:shadow-xl hover:-translate-y-1 transition-all min-h-[180px] flex flex-col justify-center active:scale-95"
                >
                  <h2 className="text-2xl text-green-700 mb-2">{garden.name}</h2>
                  <p className="text-gray-500">{gardenPlants.length} plants</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Feed View */}
      {view === 'feed' && (
        <div className="p-5 max-w-[1400px] mx-auto">
          {isLoading ? (
            <div className="text-center py-20 text-gray-500">Loading...</div>
          ) : updates.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-md">
              <h3 className="text-lg mb-2">No updates for {activeGarden?.name}</h3>
              <p className="text-gray-500">Tap + to start.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {updates.map(update => (
                <div
                  key={update.id}
                  onClick={(e) => openDetailModal(update, e)}
                  className={`bg-white rounded-2xl p-5 shadow-md relative border-l-4 transition-all cursor-pointer hover:shadow-lg ${isSelecting ? 'pl-8' : ''} ${selectedIds.has(update.id!) ? 'bg-green-50 border-l-green-700' : 'border-l-transparent'}`}
                >
                  {isSelecting && (
                    <div
                      className="absolute left-2 top-5 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelection(update.id!)
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(update.id!)}
                        onChange={() => toggleSelection(update.id!)}
                        className="w-5 h-5 accent-green-700"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-block bg-green-100 text-green-900 font-bold px-3 py-1.5 rounded-lg text-sm">
                          {update.type}
                        </span>
                        {update.conditionIds && update.conditionIds.map(conditionId => {
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
                      <p className="text-sm text-gray-500">
                        <strong>{update.garden}</strong> • {update.plantId}
                      </p>
                    </div>
                    {/* Desktop: Show icons directly */}
                    <div className="hidden md:flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => shareSingle(update)}
                        className="p-1.5 opacity-60 hover:opacity-100 hover:scale-110 transition-all text-green-600"
                        title="Share to WhatsApp"
                      >
                        <Share2 size={20} />
                      </button>
                      <button
                        onClick={() => handleEdit(update)}
                        className="p-1.5 opacity-60 hover:opacity-100 hover:scale-110 transition-all text-blue-600"
                        title="Edit"
                      >
                        <Edit size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(update.id!)}
                        className="p-1.5 opacity-60 hover:opacity-100 hover:scale-110 transition-all text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    {/* Mobile: Hamburger menu */}
                    <div className="md:hidden relative menu-container" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === update.id ? null : update.id!)}
                        className="p-1.5 text-gray-600 hover:text-gray-900 transition-all"
                        title="More options"
                      >
                        <MoreVertical size={20} />
                      </button>
                      {openMenuId === update.id && (
                        <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                          <button
                            onClick={() => {
                              shareSingle(update)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-3 transition-colors"
                          >
                            <Share2 size={16} />
                            Share
                          </button>
                          <button
                            onClick={() => {
                              handleEdit(update)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-3 transition-colors"
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDelete(update.id!)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-3 transition-colors"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap mb-4">{truncateText(update.desc, 25)}</p>
                  {update.media && (
                    <div className="relative mb-4" onClick={(e) => openDetailModal(update, e)}>
                      {renderMedia(update.media, update.mediaType)}
                      <div className="absolute inset-0 bg-black/10 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-white/90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">Tap to view</span>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                    📅 {update.date}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      {activeGarden && !isSelecting && (
        <button
          onClick={openModal}
          className="fixed bottom-8 right-8 w-16 h-16 bg-green-700 text-white rounded-full flex items-center justify-center text-3xl shadow-lg hover:scale-110 hover:shadow-xl transition-all z-[200]"
        >
          <Plus size={32} />
        </button>
      )}

      {/* Bulk Action Bar */}
      {isSelecting && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-[250] flex justify-between items-center gap-5 md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl md:rounded-full md:p-4">
          <div className="font-bold text-gray-800">
            {selectedIds.size} selected
          </div>
          <div className="flex gap-4">
            <button
              onClick={shareBulk}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:-translate-y-0.5 transition-all"
            >
              📲 Share (WA)
            </button>
            <button
              onClick={downloadPDF}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:-translate-y-0.5 transition-all"
            >
              📄 Download PDF
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[310] flex items-end justify-center p-0 md:items-center md:p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h2 className="text-xl text-black font-semibold">{isEditing ? 'Edit Report' : 'New Report'}</h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-red-600 text-3xl transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Plant Type */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Plant Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full px-4 py-4 border text-[#1B211A] border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 transition-all"
                  required
                >
                  <option value="" disabled>Select Type...</option>
                  {getAvailableTypes().map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Specific Plant */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Specific Plant
                </label>
                <select
                  value={formData.plantId}
                  onChange={(e) => handleInputChange('plantId', e.target.value)}
                  disabled={!formData.type}
                  className="w-full px-4 py-4 border text-[#1B211A] border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                >
                  <option value="" disabled>Select Plant...</option>
                  {getAvailablePlants().map(plant => (
                    <option key={plant.id} value={plant.id}>{plant.plantName}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Description
                </label>
                <textarea
                  value={formData.desc}
                  onChange={(e) => handleInputChange('desc', e.target.value)}
                  placeholder="Health, watering, issues..."
                  className="w-full px-4 py-4 border text-[#1B211A] border-gray-300 rounded-lg bg-gray-50 min-h-[120px] focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 transition-all resize-y"
                  required
                />
                {recognitionRef.current && (
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    className={`mt-2 w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${isListening ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                  >
                    <Mic size={20} />
                    {isListening ? 'Listening...' : 'Tap to Speak'}
                  </button>
                )}
              </div>

              {/* Condition */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Plant Conditions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {conditions.map(condition => (
                    <label
                      key={condition.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        (formData.conditionIds || []).includes(condition.id!)
                          ? 'border-green-700 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(formData.conditionIds || []).includes(condition.id!)}
                        onChange={() => toggleCondition(condition.id!)}
                        className="w-5 h-5 accent-green-700"
                      />
                      <span className="text-sm">
                        {condition.icon} {condition.name}
                      </span>
                    </label>
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
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="flex-1 py-4 border-none rounded-lg text-lg font-semibold text-white bg-green-700 hover:bg-green-800 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isEditing ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    <>{isEditing ? 'Update Report' : 'Done'}</>
                  )}
                </button>
                {!isEditing && (
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-4 border-none rounded-lg text-lg font-semibold text-white bg-blue-700 hover:bg-blue-800 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>Save & Next</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                <strong>{selectedUpdate.garden}</strong> • 📅 {selectedUpdate.date}
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
                  <Share2 size={20} />
                  <div className='md:block hidden'>Share to WhatsApp</div>
                </button>
                <button
                  onClick={() => {
                    handleEdit(selectedUpdate)
                    closeDetailModal()
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                >
                  <Edit size={20} />
                  <div className='md:block hidden'>Edit Report</div>
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedUpdate.id!)
                    closeDetailModal()
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-all"
                >
                  <Trash2 size={20} />
                  <div className='md:block hidden'>Delete</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-8 py-4 rounded-full text-lg shadow-lg z-[400] transition-all">
          {toast.message}
        </div>
      )}

      {/* Load jsPDF */}
      <Script />
    </div>
  )
}

function Script() {
  useEffect(() => {
    // Load jsPDF from CDN
    const script1 = document.createElement('script')
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script1.async = true

    const script2 = document.createElement('script')
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
    script2.async = true

    document.head.appendChild(script1)
    document.head.appendChild(script2)
  }, [])

  return null
}
