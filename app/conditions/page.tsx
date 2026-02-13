'use client'

import { useEffect, useState } from 'react'
import { supabase, type Condition, getConditions, createCondition, updateCondition, deleteCondition } from '@/lib/supabase'
import { Plus, Edit, Trash2, Check, X, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function ConditionsPage() {
  const [conditions, setConditions] = useState<Condition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    color: '#10B981',
    icon: '✅',
    displayOrder: 0,
    isActive: true,
  })

  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  // Load conditions
  useEffect(() => {
    loadConditions()
  }, [showInactive])

  const loadConditions = async () => {
    setIsLoading(true)
    const data = await getConditions(!showInactive)
    setConditions(data)
    setIsLoading(false)
  }

  // Modal handlers
  const openModal = () => {
    setIsModalOpen(true)
    setIsEditing(false)
    setEditId(null)
    setFormData({
      name: '',
      slug: '',
      color: '#10B981',
      icon: '✅',
      displayOrder: conditions.length + 1,
      isActive: true,
    })
  }

  const openEditModal = (condition: Condition) => {
    setIsModalOpen(true)
    setIsEditing(true)
    setEditId(condition.id || null)
    setFormData({
      name: condition.name,
      slug: condition.slug,
      color: condition.color,
      icon: condition.icon,
      displayOrder: condition.displayOrder,
      isActive: condition.isActive,
    })
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setIsEditing(false)
    setEditId(null)
  }

  // Form handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.slug.trim()) {
      showToast('Name and slug are required', 'error')
      return
    }

    // Generate slug from name if empty
    let slug = formData.slug.trim()
    if (!slug && formData.name.trim()) {
      slug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    }

    const submitData = {
      ...formData,
      slug,
      name: formData.name.trim(),
    }

    let success = false
    if (isEditing && editId) {
      const result = await updateCondition(editId, submitData)
      success = result !== null
      showToast(success ? 'Condition updated!' : 'Failed to update condition', success ? 'success' : 'error')
    } else {
      const result = await createCondition(submitData as Condition)
      success = result !== null
      showToast(success ? 'Condition created!' : 'Failed to create condition', success ? 'success' : 'error')
    }

    if (success) {
      await loadConditions()
      closeModal()
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this condition? This will affect any reports using this condition.')) {
      const success = await deleteCondition(id)
      if (success) {
        showToast('Condition deleted!', 'success')
        await loadConditions()
      } else {
        showToast('Failed to delete condition', 'error')
      }
    }
  }

  const toggleActive = async (condition: Condition) => {
    const success = await updateCondition(condition.id!, { isActive: !condition.isActive })
    if (success) {
      showToast(`Condition ${condition.isActive ? 'disabled' : 'enabled'}!`, 'success')
      await loadConditions()
    } else {
      showToast('Failed to update condition', 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  // Predefined icons
  const iconOptions = ['✅', '❌', '⚠️', '🌸', '🍊', '🍯', '💊', '📝', '🟢', '🔴', '🟡', '🟣']

  // Predefined colors
  const colorOptions = [
    { name: 'Green', value: '#10B981' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Yellow', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Blue', value: '#3B82F6' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-green-700 text-white px-5 py-3 flex justify-between items-center h-[60px] shadow-lg">
        <h1 className="text-xl font-semibold">Manage Conditions</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${showInactive ? 'bg-white/40' : ''}`}
          >
            {showInactive ? <Eye size={16} /> : <EyeOff size={16} />}
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
          <Link
            href="/"
            className="bg-white/20 hover:bg-white/40 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
          >
            Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="p-5 max-w-4xl mx-auto">
        {/* Add Button */}
        <div className="mb-6">
          <button
            onClick={openModal}
            className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-green-800 transition-all"
          >
            <Plus size={20} />
            Add New Condition
          </button>
        </div>

        {/* Conditions List */}
        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : conditions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-md">
            <h3 className="text-lg mb-2">No conditions found</h3>
            <p className="text-gray-500">Click "Add New Condition" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conditions.map(condition => (
              <div
                key={condition.id}
                className={`bg-white rounded-xl p-5 shadow-md flex items-center justify-between transition-all ${!condition.isActive ? 'opacity-60 grayscale' : ''}`}
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Icon preview */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-inner"
                    style={{ backgroundColor: condition.color + '20' }}
                  >
                    {condition.icon}
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{condition.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{condition.slug}</code>
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: condition.color }}
                        title={condition.color}
                      />
                      <span className="text-xs text-gray-500">Order: {condition.displayOrder}</span>
                      {!condition.isActive && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Inactive</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(condition)}
                    className={`p-2 rounded-lg transition-all ${condition.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-600 hover:bg-gray-100'}`}
                    title={condition.isActive ? 'Disable' : 'Enable'}
                  >
                    {condition.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button
                    onClick={() => openEditModal(condition)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(condition.id!)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center p-0 md:items-center md:p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h2 className="text-xl text-black font-semibold">{isEditing ? 'Edit Condition' : 'New Condition'}</h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-red-600 text-3xl transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Healthy, Flowering, Needs Treatment"
                  className="w-full px-4 py-4 text-black border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 transition-all"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Slug (URL-friendly ID) *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                  placeholder="e.g., healthy, flowering, needs-treatment"
                  className="w-full px-4 py-4 border text-black border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 transition-all"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Auto-generated from name if left blank</p>
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`w-12 h-12 rounded-lg text-2xl flex items-center justify-center border-2 transition-all ${formData.icon === icon ? 'border-green-700 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="Or type custom emoji"
                  className="w-full px-4 py-3 border text-black border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 transition-all"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${formData.color === color.value ? 'border-green-700 scale-110' : 'border-gray-200'}`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-12 rounded-lg cursor-pointer"
                />
              </div>

              {/* Display Order */}
              <div>
                <label className="block text-sm font-bold text-green-700 uppercase tracking-wide mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                  min="1"
                  className="w-full px-4 py-4 border text-black border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Preview:</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-inner"
                    style={{ backgroundColor: formData.color + '20' }}
                  >
                    {formData.icon}
                  </div>
                  <span className="font-semibold" style={{ color: formData.color }}>
                    {formData.name || 'Condition Name'}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-4 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 transition-all"
              >
                {isEditing ? 'Update Condition' : 'Create Condition'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-full text-lg shadow-lg z-[400] transition-all ${toast.type === 'success' ? 'bg-green-800 text-white' : 'bg-red-800 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
