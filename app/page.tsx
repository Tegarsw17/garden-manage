'use client'

import { useEffect, useState, useRef, MouseEvent } from 'react'
import { supabase, type GardenUpdate, type Garden, type Plant, getGardens, getPlants, getPlantsByGarden, getUpdates, createUpdate, updateUpdate, deleteUpdate, uploadMedia } from '@/lib/supabase'
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

  // Form state
  const [formData, setFormData] = useState({
    type: '',
    plantId: '',
    desc: '',
    mediaUrl: '',
  })
  const [mediaFile, setMediaFile] = useState<{ data: string; type: string } | null>(null)
  const [isListening, setIsListening] = useState(false)

  // Speech recognition
  const recognitionRef = useRef<any>(null)

  // Initialize speech recognition and load initial data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'en-US'

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

    // Load gardens and plants on mount
    loadGardensAndPlants()
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
    setFormData({ type: '', plantId: '', desc: '', mediaUrl: '' })
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({ type: '', plantId: '', desc: '', mediaUrl: '' })
    setMediaFile(null)
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

  const handleMediaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setMediaFile({
          data: event.target?.result as string,
          type: file.type
        })
        setFormData(prev => ({ ...prev, mediaUrl: '' }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMediaUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, mediaUrl: url }))
    setMediaFile(null)
  }

  const toggleSpeech = () => {
    if (!recognitionRef.current) return
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start()
  }

  // Submit handlers
  const handleSubmit = async (shouldClose: boolean) => {
    if (!activeGarden || !formData.plantId || !formData.desc) return

    // Find the selected plant
    const selectedPlant = plants.find(p => p.id === Number(formData.plantId))
    if (!selectedPlant) return

    let mediaUrl = formData.mediaUrl

    // Upload media file if present
    if (mediaFile?.data && mediaFile.data.startsWith('data:')) {
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

        const uploadedUrl = await uploadMedia(file)
        if (uploadedUrl) {
          mediaUrl = uploadedUrl
        }
      } catch (error) {
        console.error('Upload error:', error)
      }
    }

    const updateData: GardenUpdate = {
      garden: activeGarden.name,
      type: selectedPlant.plantTypeName || '',
      plantId: selectedPlant.plantName,
      desc: formData.desc,
      media: mediaUrl,
      mediaType: mediaFile?.type || 'image/jpeg',
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
      setFormData(prev => ({ ...prev, plantId: '', desc: '', mediaUrl: '' }))
      setMediaFile(null)
    }
  }

  const handleEdit = (update: GardenUpdate) => {
    setIsEditing(true)
    setEditId(update.id || null)
    setFormData({
      type: update.type,
      plantId: update.plantId,
      desc: update.desc,
      mediaUrl: update.media?.startsWith('data:') || update.media?.startsWith('blob:') ? '' : (update.media || ''),
    })
    setMediaFile(update.media?.startsWith('data:') || update.media?.startsWith('blob:') ? { data: update.media, type: update.mediaType || 'image/jpeg' } : null)
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

  // Helper function to render media
  const renderMedia = (media: string, mediaType?: string) => {
    const isVideo = mediaType?.startsWith('video')
    if (isVideo) {
      return <video controls src={media} className="w-full h-48 object-cover rounded-lg mt-3" />
    }
    return <img src={media} alt="Media" className="w-full h-48 object-cover rounded-lg mt-3" />
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
                      <span className="inline-block bg-green-100 text-green-900 font-bold px-3 py-1.5 rounded-lg text-sm">
                        {update.type}
                      </span>
                      <p className="text-sm text-gray-500 mt-2">
                         {update.plantId}
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
          className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center p-0 md:items-center md:p-4"
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

              {/* Media */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Photo / Video
                </label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <input
                    type="text"
                    value={formData.mediaUrl}
                    onChange={(e) => handleMediaUrlChange(e.target.value)}
                    placeholder="Paste Image Link here..."
                    className="w-full border-none bg-transparent outline-none text-green-700 font-medium mb-3"
                  />
                  <div className="relative text-center text-sm text-gray-400 my-3">
                    <span className="relative z-10 bg-gray-50 px-3">OR</span>
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-300 -z-0" />
                  </div>
                  <label className="block w-full py-3 text-center bg-white border border-green-700 text-green-700 rounded-lg font-semibold cursor-pointer hover:bg-green-50 transition-all">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleMediaFileSelect}
                      className="hidden"
                    />
                    📸 Upload from Camera
                  </label>
                </div>

                {/* Media Preview */}
                <div className="w-full h-48 bg-gray-100 rounded-lg mt-3 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
                  {mediaFile?.data ? (
                    mediaFile.type?.startsWith('video') ? (
                      <video src={mediaFile.data} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={mediaFile.data} alt="Preview" className="w-full h-full object-cover" />
                    )
                  ) : formData.mediaUrl ? (
                    <img src={formData.mediaUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <span className="text-gray-400">No media selected</span>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => handleSubmit(true)}
                  className="flex-1 py-4 border-none rounded-lg text-lg font-semibold text-white bg-green-700 hover:bg-green-800 hover:-translate-y-0.5 transition-all"
                >
                  {isEditing ? 'Update Report' : 'Done'}
                </button>
                {!isEditing && (
                  <button
                    onClick={() => handleSubmit(false)}
                    className="flex-1 py-4 border-none rounded-lg text-lg font-semibold text-white bg-blue-700 hover:bg-blue-800 hover:-translate-y-0.5 transition-all"
                  >
                    Save & Next
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
                <span className="inline-block bg-green-100 text-green-900 font-bold px-3 py-1.5 rounded-lg text-sm mb-2">
                  {selectedUpdate.type}
                </span>
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
                  {renderMedia(selectedUpdate.media, selectedUpdate.mediaType)}
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
