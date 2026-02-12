'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Home, Leaf, ChevronRight } from 'lucide-react'
import {
  getGardens,
  getPlantTypes,
  getPlants,
  createGarden,
  createPlantType,
  createPlant,
  updatePlant,
  deletePlant,
  type Garden,
  type PlantType,
  type Plant,
} from '@/lib/supabase'
import Link from 'next/link'

export default function PlantsPage() {
  const [gardens, setGardens] = useState<Garden[]>([])
  const [plantTypes, setPlantTypes] = useState<PlantType[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  // Form states
  const [selectedGardenId, setSelectedGardenId] = useState<number | null>(null)
  const [selectedPlantTypeId, setSelectedPlantTypeId] = useState<number | null>(null)
  const [plantName, setPlantName] = useState('')

  // New item creation states
  const [showNewGarden, setShowNewGarden] = useState(false)
  const [showNewPlantType, setShowNewPlantType] = useState(false)
  const [newGardenName, setNewGardenName] = useState('')
  const [newPlantTypeName, setNewPlantTypeName] = useState('')

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [gardensData, plantTypesData, plantsData] = await Promise.all([
      getGardens(),
      getPlantTypes(),
      getPlants(),
    ])
    setGardens(gardensData)
    setPlantTypes(plantTypesData)
    setPlants(plantsData)
    setLoading(false)
  }

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const openModal = () => {
    setIsModalOpen(true)
    setIsEditing(false)
    setEditId(null)
    setSelectedGardenId(null)
    setSelectedPlantTypeId(null)
    setPlantName('')
    setShowNewGarden(false)
    setShowNewPlantType(false)
    setNewGardenName('')
    setNewPlantTypeName('')
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setShowNewGarden(false)
    setShowNewPlantType(false)
    setNewGardenName('')
    setNewPlantTypeName('')
  }

  const handleEdit = (plant: Plant) => {
    setIsEditing(true)
    setEditId(plant.id || null)
    setSelectedGardenId(plant.gardenId)
    setSelectedPlantTypeId(plant.plantTypeId)
    setPlantName(plant.plantName)
    setIsModalOpen(true)
    setShowNewGarden(false)
    setShowNewPlantType(false)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this plant?')) {
      const success = await deletePlant(id)
      if (success) {
        showNotification('Plant deleted successfully')
        await loadData()
      } else {
        showNotification('Failed to delete plant', 'error')
      }
    }
  }

  const handleCreateGarden = async () => {
    if (!newGardenName.trim()) {
      showNotification('Please enter a garden name', 'error')
      return
    }

    const result = await createGarden(newGardenName.trim())
    if (result) {
      showNotification('Garden created successfully')
      await loadData()
      setSelectedGardenId(result.id || null)
      setNewGardenName('')
      setShowNewGarden(false)
    } else {
      showNotification('Failed to create garden', 'error')
    }
  }

  const handleCreatePlantType = async () => {
    if (!newPlantTypeName.trim()) {
      showNotification('Please enter a plant type', 'error')
      return
    }

    const result = await createPlantType(newPlantTypeName.trim())
    if (result) {
      showNotification('Plant type created successfully')
      await loadData()
      setSelectedPlantTypeId(result.id || null)
      setNewPlantTypeName('')
      setShowNewPlantType(false)
    } else {
      showNotification('Failed to create plant type', 'error')
    }
  }

  const handleSubmit = async () => {
    if (!selectedGardenId || !selectedPlantTypeId || !plantName.trim()) {
      showNotification('Please fill in all fields', 'error')
      return
    }

    if (isEditing && editId) {
      // Update existing plant
      const result = await updatePlant(editId, {
        gardenId: selectedGardenId,
        plantTypeId: selectedPlantTypeId,
        plantName: plantName.trim(),
      })
      if (result) {
        showNotification('Plant updated successfully')
        await loadData()
        closeModal()
      } else {
        showNotification('Failed to update plant', 'error')
      }
    } else {
      // Create new plant
      const result = await createPlant({
        gardenId: selectedGardenId,
        plantTypeId: selectedPlantTypeId,
        plantName: plantName.trim(),
      })
      if (result) {
        showNotification('Plant added successfully')
        await loadData()
        closeModal()
      } else {
        showNotification('Failed to add plant', 'error')
      }
    }
  }

  const getGardenName = (gardenId: number) => {
    const garden = gardens.find(g => g.id === gardenId)
    return garden?.name || 'Unknown'
  }

  const getPlantTypeName = (plantTypeId: number) => {
    const plantType = plantTypes.find(pt => pt.id === plantTypeId)
    return plantType?.name || 'Unknown'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-green-100 mb-2">
            <Link href="/" className="hover:text-white transition-colors">
              <Home size={18} />
            </Link>
            <ChevronRight size={14} />
            <span className="text-sm">Plant Management</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Leaf className="w-8 h-8" />
                Plant Management
              </h1>
              <p className="text-green-100 mt-1">Manage your gardens and plants</p>
            </div>
            <button
              onClick={openModal}
              className="bg-white text-green-700 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-green-50 transition-colors shadow-md"
            >
              <Plus size={20} />
              Add Plant
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-green-600">{gardens.length}</div>
            <div className="text-gray-600 mt-1">Gardens</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-blue-600">{plantTypes.length}</div>
            <div className="text-gray-600 mt-1">Plant Types</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-purple-600">{plants.length}</div>
            <div className="text-gray-600 mt-1">Total Plants</div>
          </div>
        </div>

        {/* Plants Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">All Plants</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Garden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Plant Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Plant Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {plants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Leaf className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-lg font-medium">No plants yet</p>
                        <p className="text-sm mt-1">Add your first plant to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  plants.map((plant) => (
                    <tr key={plant.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {getGardenName(plant.gardenId)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {getPlantTypeName(plant.plantTypeId)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                        {plant.plantName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleEdit(plant)}
                          className="text-blue-600 hover:text-blue-800 mr-3 transition-colors"
                          title="Edit plant"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(plant.id!)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Delete plant"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {isEditing ? 'Edit Plant' : 'Add New Plant'}
              </h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Garden Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Garden
                </label>
                {!showNewGarden ? (
                  <div className="space-y-2">
                    <select
                      value={selectedGardenId || ''}
                      onChange={(e) => setSelectedGardenId(Number(e.target.value))}
                      className="w-full px-4 py-2 text-[#1B211A] border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select a garden</option>
                      {gardens.map((garden) => (
                        <option key={garden.id} value={garden.id}>
                          {garden.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewGarden(true)}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      + Create new garden
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newGardenName}
                      onChange={(e) => setNewGardenName(e.target.value)}
                      placeholder="Enter garden name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateGarden}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowNewGarden(false)
                          setNewGardenName('')
                        }}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Plant Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plant Type
                </label>
                {!showNewPlantType ? (
                  <div className="space-y-2">
                    <select
                      value={selectedPlantTypeId || ''}
                      onChange={(e) => setSelectedPlantTypeId(Number(e.target.value))}
                      className="w-full px-4 py-2 border text-[#1B211A] border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select a plant type</option>
                      {plantTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewPlantType(true)}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      + Create new plant type
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newPlantTypeName}
                      onChange={(e) => setNewPlantTypeName(e.target.value)}
                      placeholder="Enter plant type"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreatePlantType}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowNewPlantType(false)
                          setNewPlantTypeName('')
                        }}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Plant Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plant Name
                </label>
                <input
                  type="text"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                  placeholder="e.g., My Mango Tree"
                  className="w-full px-4 py-2 border text-[#1B211A] border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {isEditing ? 'Update' : 'Add'} Plant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
