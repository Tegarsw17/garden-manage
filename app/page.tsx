'use client'

import { useEffect, useRef, useState } from 'react'
import { type GardenUpdate, type Garden, type Plant, type Condition, getGardens, getPlants, getPlantsByGarden, getUpdates, getConditions, createUpdate, updateUpdate, deleteUpdate, uploadMedia } from '@/lib/supabase'
import { Share2, Edit, Trash2, Plus, X, Mic, Leaf, MoreVertical, LoaderCircle, CircleCheck, CircleX } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

type FormField = 'type' | 'plantId' | 'desc'

type DraftAttachment =
  | {
      id: string
      kind: 'local'
      file: File
      previewUrl: string
      type: string
    }
  | {
      id: string
      kind: 'remote'
      url: string
      type: string
    }

type QueueAttachment =
  | {
      kind: 'local'
      file: File
      type: string
    }
  | {
      kind: 'remote'
      url: string
      type: string
    }

type SubmissionJobStatus = 'queued' | 'uploading' | 'saving' | 'success' | 'error'

type SubmissionJob = {
  id: string
  gardenName: string
  plantName: string
  plantType: string
  description: string
  conditionIds: number[]
  date: string
  attachments: QueueAttachment[]
  uploadTargetCount: number
  uploadedCount: number
  status: SubmissionJobStatus
  errorMessage?: string
}

type UploadedMediaResult = {
  urls: string[]
  types: string[]
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike>

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

const createAttachmentId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildDraftAttachments(files: File[]): DraftAttachment[] {
  return files.map((file) => ({
    id: createAttachmentId(),
    kind: 'local',
    file,
    previewUrl: URL.createObjectURL(file),
    type: file.type,
  }))
}

function toQueueAttachments(attachments: DraftAttachment[]): QueueAttachment[] {
  return attachments.map((attachment) =>
    attachment.kind === 'local'
      ? {
          kind: 'local',
          file: attachment.file,
          type: attachment.type,
        }
      : {
          kind: 'remote',
          url: attachment.url,
          type: attachment.type,
        }
  )
}

function revokeAttachmentPreview(attachment: DraftAttachment) {
  if (attachment.kind === 'local') {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}

function revokeAttachmentPreviews(attachments: DraftAttachment[]) {
  attachments.forEach(revokeAttachmentPreview)
}

function getAttachmentPreviewSource(attachment: DraftAttachment) {
  return attachment.kind === 'local' ? attachment.previewUrl : attachment.url
}

function getUploadTargetCount(attachments: QueueAttachment[]) {
  return attachments.filter((attachment) => attachment.kind === 'local').length
}

async function uploadReportAttachments(
  attachments: QueueAttachment[],
  onProgress?: (uploadedCount: number, totalCount: number) => void
): Promise<UploadedMediaResult> {
  const urls: string[] = []
  const types: string[] = []
  const totalCount = getUploadTargetCount(attachments)
  let uploadedCount = 0

  for (const attachment of attachments) {
    if (attachment.kind === 'remote') {
      urls.push(attachment.url)
      types.push(attachment.type)
      continue
    }

    const uploadedUrl = await uploadMedia(attachment.file)
    if (!uploadedUrl) {
      throw new Error(`Failed to upload media ${uploadedCount + 1} of ${totalCount}`)
    }

    uploadedCount += 1
    urls.push(uploadedUrl)
    types.push(attachment.type)
    onProgress?.(uploadedCount, totalCount)
  }

  return { urls, types }
}

function describeJobStatus(job: SubmissionJob) {
  if (job.status === 'queued' || job.status === 'uploading' || job.status === 'saving') {
    return 'Uploading'
  }

  if (job.status === 'success') {
    return 'Finished'
  }

  return 'Failed'
}

async function loadGardenFeedData(garden: Garden): Promise<{
  plantsData: Plant[]
  updatesData: GardenUpdate[]
}> {
  if (!garden.id) {
    return {
      plantsData: [],
      updatesData: [],
    }
  }

  const [updatesData, plantsData] = await Promise.all([
    getUpdates(garden.name),
    getPlantsByGarden(garden.id),
  ])

  return { plantsData, updatesData }
}

export default function Home() {
  const pathname = usePathname()
  const router = useRouter()

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
  const [submissionJobs, setSubmissionJobs] = useState<SubmissionJob[]>([])

  // Form state
  const [formData, setFormData] = useState({
    type: '',
    plantId: '',
    desc: '',
    conditionIds: [] as number[],
  })
  const [mediaFiles, setMediaFiles] = useState<DraftAttachment[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Speech recognition
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const processingJobIdRef = useRef<string | null>(null)
  const submissionJobsRef = useRef<SubmissionJob[]>([])
  const activeGardenRef = useRef<Garden | null>(null)

  // Initialize speech recognition and load initial data
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor()
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'id-ID'

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript
        if (!transcript) {
          return
        }

        setFormData((prev) => ({
          ...prev,
          desc: prev.desc ? `${prev.desc} ${transcript}` : transcript,
        }))
      }

      recognitionRef.current = recognition
    }

    void loadGardensAndPlants()
    void loadConditions()
  }, [])

  useEffect(() => {
    activeGardenRef.current = activeGarden
  }, [activeGarden])

  useEffect(() => {
    if (pathname === '/') {
      setActiveGarden(null)
      setView('dashboard')
      setIsSelecting(false)
      setSelectedIds(new Set())
      return
    }

    const gardenId = Number(pathname.match(/^\/gardens\/(\d+)$/)?.[1])
    if (!Number.isFinite(gardenId) || gardens.length === 0) {
      return
    }

    const routeGarden = gardens.find((garden) => garden.id === gardenId)
    if (!routeGarden) {
      router.replace('/')
      return
    }

    setActiveGarden(routeGarden)
    setView('feed')
    setIsSelecting(false)
    setSelectedIds(new Set())
  }, [gardens, pathname, router])

  // Load updates when active garden changes
  useEffect(() => {
    if (!activeGarden) {
      return
    }

    const garden = activeGarden
    let isCancelled = false

    async function run() {
      setIsLoading(true)
      const { plantsData, updatesData } = await loadGardenFeedData(garden)
      if (isCancelled) {
        return
      }

      setPlants(plantsData)
      setUpdates(updatesData)
      setIsLoading(false)
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [activeGarden])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.menu-container')) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadGardensAndPlants() {
    const gardensData = await getGardens()
    const plantsData = await getPlants()
    setGardens(gardensData)
    setPlants(plantsData)
  }

  async function loadConditions() {
    const conditionsData = await getConditions(true) // Only active conditions
    setConditions(conditionsData)
  }

  const setSubmissionJobsState = (
    nextJobs:
      | SubmissionJob[]
      | ((previousJobs: SubmissionJob[]) => SubmissionJob[])
  ) => {
    const resolvedJobs =
      typeof nextJobs === 'function'
        ? nextJobs(submissionJobsRef.current)
        : nextJobs

    submissionJobsRef.current = resolvedJobs
    setSubmissionJobs(resolvedJobs)
  }

  const updateSubmissionJob = (
    jobId: string,
    updater: (job: SubmissionJob) => SubmissionJob
  ) => {
    setSubmissionJobsState((previousJobs) =>
      previousJobs.map((job) => (job.id === jobId ? updater(job) : job))
    )
  }

  const dismissSubmissionJob = (jobId: string) => {
    setSubmissionJobsState((previousJobs) =>
      previousJobs.filter((job) => job.id !== jobId)
    )
  }

  const scheduleSubmissionDismiss = (jobId: string, delayMs: number = 4000) => {
    setTimeout(() => {
      const targetJob = submissionJobsRef.current.find((job) => job.id === jobId)
      if (targetJob?.status === 'success') {
        dismissSubmissionJob(jobId)
      }
    }, delayMs)
  }

  const processNextSubmissionJob = async () => {
    if (processingJobIdRef.current) {
      return
    }

    const nextJob = submissionJobsRef.current.find((job) => job.status === 'queued')
    if (!nextJob) {
      return
    }

    processingJobIdRef.current = nextJob.id
    updateSubmissionJob(nextJob.id, (job) => ({
      ...job,
      status: job.uploadTargetCount > 0 ? 'uploading' : 'saving',
      uploadedCount: 0,
      errorMessage: undefined,
    }))

    try {
      const uploadedMedia = await uploadReportAttachments(nextJob.attachments, (uploadedCount) => {
        updateSubmissionJob(nextJob.id, (job) => ({
          ...job,
          status: uploadedCount < job.uploadTargetCount ? 'uploading' : 'saving',
          uploadedCount,
        }))
      })

      updateSubmissionJob(nextJob.id, (job) => ({
        ...job,
        status: 'saving',
        uploadedCount: job.uploadTargetCount,
      }))

      const updateData: GardenUpdate = {
        garden: nextJob.gardenName,
        type: nextJob.plantType,
        plantId: nextJob.plantName,
        desc: nextJob.description,
        media: uploadedMedia.urls,
        mediaType: uploadedMedia.types,
        conditionIds: nextJob.conditionIds,
        date: nextJob.date,
      }

      const savedUpdate = await createUpdate(updateData)
      if (!savedUpdate) {
        throw new Error('Failed to save report to database')
      }

      updateSubmissionJob(nextJob.id, (job) => ({
        ...job,
        status: 'success',
        uploadedCount: job.uploadTargetCount,
      }))

      if (activeGardenRef.current?.name === nextJob.gardenName) {
        setUpdates((previousUpdates) => [
          savedUpdate,
          ...previousUpdates.filter((update) => update.id !== savedUpdate.id),
        ])
      }

      scheduleSubmissionDismiss(nextJob.id)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload report'

      updateSubmissionJob(nextJob.id, (job) => ({
        ...job,
        status: 'error',
        errorMessage: message,
      }))
    } finally {
      processingJobIdRef.current = null
      void processNextSubmissionJob()
    }
  }

  const retrySubmissionJob = (jobId: string) => {
    updateSubmissionJob(jobId, (job) => ({
      ...job,
      status: 'queued',
      uploadedCount: 0,
      errorMessage: undefined,
    }))

    void processNextSubmissionJob()
  }

  const enqueueSubmissionJob = (job: SubmissionJob) => {
    setSubmissionJobsState((previousJobs) => [...previousJobs, job])
    void processNextSubmissionJob()
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
    if (garden.id) {
      router.push(`/gardens/${garden.id}`)
    }

    setActiveGarden(garden)
    setView('feed')
  }

  const switchGarden = () => {
    router.push('/')
    setActiveGarden(null)
    setView('dashboard')
    setIsSelecting(false)
    setSelectedIds(new Set())
    void loadGardensAndPlants()
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

  const clearDraftAttachments = () => {
    revokeAttachmentPreviews(mediaFiles)
    setMediaFiles([])
  }

  const resetForm = () => {
    setFormData({ type: '', plantId: '', desc: '', conditionIds: [] })
    clearDraftAttachments()
    setIsEditing(false)
    setEditId(null)
  }

  // Form handlers
  const handleInputChange = (field: FormField, value: string) => {
    setFormData((prev) => {
      if (field === 'type') {
        return { ...prev, type: value, plantId: '' }
      }

      return { ...prev, [field]: value }
    })
  }

  const handleMediaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const newFiles = buildDraftAttachments(files)
      setMediaFiles((prev) => [...prev, ...newFiles])
    }

    e.target.value = ''
  }

  const toggleSpeech = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      return
    }

    recognitionRef.current.start()
  }

  const removeMediaFile = (index: number) => {
    setMediaFiles((previousFiles) => {
      const targetFile = previousFiles[index]
      if (targetFile) {
        revokeAttachmentPreview(targetFile)
      }

      return previousFiles.filter((_, fileIndex) => fileIndex !== index)
    })
  }

  // Submit handlers
  const handleSubmit = async (shouldClose: boolean) => {
    if (!activeGarden || !formData.plantId || !formData.desc) {
      return
    }

    const selectedPlant = plants.find((plant) => plant.id === Number(formData.plantId))
    if (!selectedPlant) {
      return
    }

    const reportDate = new Date().toLocaleString()
    const queuedAttachments = toQueueAttachments(mediaFiles)

    if (!isEditing) {
      enqueueSubmissionJob({
        id: createAttachmentId(),
        gardenName: activeGarden.name,
        plantName: selectedPlant.plantName,
        plantType: selectedPlant.plantTypeName || '',
        description: formData.desc,
        conditionIds: formData.conditionIds,
        date: reportDate,
        attachments: queuedAttachments,
        uploadTargetCount: getUploadTargetCount(queuedAttachments),
        uploadedCount: 0,
        status: 'queued',
      })

      showToast(
        queuedAttachments.length > 0
          ? `Uploading ${selectedPlant.plantName} in background`
          : `Saving ${selectedPlant.plantName} in background`
      )

      if (shouldClose) {
        closeModal()
      } else {
        revokeAttachmentPreviews(mediaFiles)
        setFormData((prev) => ({ ...prev, plantId: '', desc: '', conditionIds: [] }))
        setMediaFiles([])
      }

      return
    }

    if (isSubmitting || !editId) {
      return
    }

    setIsSubmitting(true)

    try {
      const uploadedMedia = await uploadReportAttachments(queuedAttachments)

      const updateData: GardenUpdate = {
        garden: activeGarden.name,
        type: selectedPlant.plantTypeName || '',
        plantId: selectedPlant.plantName,
        desc: formData.desc,
        media: uploadedMedia.urls,
        mediaType: uploadedMedia.types,
        conditionIds: formData.conditionIds,
        date: reportDate,
      }

      await updateUpdate(editId, updateData)
      showToast('Report updated!')

      const { plantsData, updatesData } = await loadGardenFeedData(activeGarden)
      setPlants(plantsData)
      setUpdates(updatesData)

      if (shouldClose) {
        closeModal()
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
    const loadedFiles: DraftAttachment[] = []
    existingMediaUrls.forEach((url, i) => {
      if (url && url.startsWith && !url.startsWith('data:') && !url.startsWith('blob:')) {
        const type = existingMediaTypes[i] || 'image/jpeg'
        loadedFiles.push({
          id: createAttachmentId(),
          kind: 'remote',
          url,
          type,
        })
      }
    })

    revokeAttachmentPreviews(mediaFiles)
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
      if (activeGarden) {
        const { plantsData, updatesData } = await loadGardenFeedData(activeGarden)
        setPlants(plantsData)
        setUpdates(updatesData)
      }
      showToast('Report deleted.')
    }
  }

  // Detail modal handlers
  const openDetailModal = (update: GardenUpdate, e?: React.MouseEvent<HTMLElement>) => {
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
    const mediaText = update.media && update.media.length > 0 ? `\n\n${update.media.join('\n')}` : ''
    const text = `*Garden Report*\n\n🌱 *Garden:* ${update.garden}\n🌿 *Plant:* ${update.type} (${update.plantId})\n📝 *Note:* ${update.desc}${mediaText}`
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
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF()

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
      autoTable(doc, {
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
          <div className="bg-white text-gray-900 w-full max-w-lg rounded-t-2xl md:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
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
                          ? 'border-green-700 bg-green-50 text-green-950'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(formData.conditionIds || []).includes(condition.id!)}
                        onChange={() => toggleCondition(condition.id!)}
                        className="w-5 h-5 accent-green-700"
                      />
                      <span className="text-sm font-semibold leading-snug">
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
                        {file.type.startsWith('video') ? (
                          <video src={getAttachmentPreviewSource(file)} controls className="w-full h-24 object-cover rounded-lg" />
                        ) : (
                          <img src={getAttachmentPreviewSource(file)} alt={`Preview ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
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
                  disabled={isEditing && isSubmitting}
                  className="flex-1 py-4 border-none rounded-lg text-lg font-semibold text-white bg-green-700 hover:bg-green-800 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  {isEditing && isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    <>{isEditing ? 'Update Report' : 'Done'}</>
                  )}
                </button>
                {!isEditing && (
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={false}
                    className="flex-1 py-4 border-none rounded-lg text-lg font-semibold text-white bg-blue-700 hover:bg-blue-800 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                  >
                    <>Save & Next</>
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

      {submissionJobs.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-[420] space-y-2 md:top-auto md:bottom-4 md:left-auto md:right-4 md:w-[340px]">
          {submissionJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => {
                if (job.status === 'error') {
                  retrySubmissionJob(job.id)
                  return
                }

                if (job.status === 'success') {
                  dismissSubmissionJob(job.id)
                }
              }}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-lg backdrop-blur transition-all ${
                job.status === 'error'
                  ? 'border-red-200 bg-white/95'
                  : 'border-gray-200 bg-white/95'
              }`}
            >
              {job.status === 'success' ? (
                <CircleCheck className="h-5 w-5 shrink-0 text-green-600" />
              ) : job.status === 'error' ? (
                <CircleX className="h-5 w-5 shrink-0 text-red-600" />
              ) : (
                <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
              )}

              <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                {job.plantName} • {describeJobStatus(job)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
