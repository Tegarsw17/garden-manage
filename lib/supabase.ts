import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface Garden {
  id?: number
  name: string
  created_at?: string
}

export interface PlantType {
  id?: number
  name: string
  created_at?: string
}

export interface Plant {
  id?: number
  gardenId: number
  plantTypeId: number
  plantName: string
  // Joined fields for display
  gardenName?: string
  plantTypeName?: string
  created_at?: string
}

export interface GardenUpdate {
  id?: number
  garden: string
  type: string
  plantId: string
  desc: string
  media?: string
  mediaType?: string
  date: string
  created_at?: string
}

// Garden data configuration
export const PLANT_COUNT = 10

export const generateIds = (name: string, count: number) => {
  const arr: string[] = []
  for (let i = 1; i <= count; i++) arr.push(`${name} ${i}`)
  return arr
}

export const GARDEN_DATA: Record<string, Record<string, string[]>> = {
  'Garden 1': {
    'Mango': generateIds('Mango', PLANT_COUNT),
    'Orange': generateIds('Orange', PLANT_COUNT),
    'Avocado': generateIds('Avocado', PLANT_COUNT),
    'Banana': generateIds('Banana', PLANT_COUNT),
    'Durian': generateIds('Durian', PLANT_COUNT),
  },
  'Garden 2': {
    'Mango': generateIds('Mango', PLANT_COUNT),
    'Orange': generateIds('Orange', PLANT_COUNT),
    'Avocado': generateIds('Avocado', PLANT_COUNT),
    'Banana': generateIds('Banana', PLANT_COUNT),
    'Durian': generateIds('Durian', PLANT_COUNT),
  },
  'Garden 3': {
    'Mango': generateIds('Mango', PLANT_COUNT),
    'Orange': generateIds('Orange', PLANT_COUNT),
    'Avocado': generateIds('Avocado', PLANT_COUNT),
    'Banana': generateIds('Banana', PLANT_COUNT),
    'Durian': generateIds('Durian', PLANT_COUNT),
  },
}

// Database functions
export async function getUpdates(garden?: string): Promise<GardenUpdate[]> {
  let query = supabase.from('updates').select('*').order('created_at', { ascending: false })

  if (garden) {
    query = query.eq('garden', garden)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching updates:', error)
    return []
  }

  // Map snake_case to camelCase
  return (data || []).map(item => ({
    ...item,
    plantId: item.plant_id,
  })) as GardenUpdate[]
}

export async function createUpdate(update: GardenUpdate): Promise<GardenUpdate | null> {
  try {
    // Map camelCase to snake_case for database columns
    const dbData = {
      garden: update.garden,
      type: update.type,
      plant_id: update.plantId,
      desc: update.desc,
      media: update.media,
      date: update.date,
    }

    const { data, error } = await supabase
      .from('updates')
      .insert([dbData])
      .select()

    if (error) {
      console.error('Supabase error creating update:', error)
      return null
    }

    // Map snake_case back to camelCase for response
    return data && data.length > 0 ? {
      ...data[0],
      plantId: data[0].plant_id,
    } as GardenUpdate : null
  } catch (err) {
    console.error('Unexpected error creating update:', err)
    return null
  }
}

export async function updateUpdate(id: number, update: Partial<GardenUpdate>): Promise<GardenUpdate | null> {
  // Map camelCase to snake_case for database
  const dbData: any = {}
  if (update.garden !== undefined) dbData.garden = update.garden
  if (update.type !== undefined) dbData.type = update.type
  if (update.plantId !== undefined) dbData.plant_id = update.plantId
  if (update.desc !== undefined) dbData.desc = update.desc
  if (update.media !== undefined) dbData.media = update.media
  if (update.date !== undefined) dbData.date = update.date

  const { data, error } = await supabase.from('updates').update(dbData).eq('id', id).select()

  if (error) {
    console.error('Error updating update:', error)
    return null
  }

  // Map snake_case to camelCase
  return data && data.length > 0 ? {
    ...data[0],
    plantId: data[0].plant_id,
  } as GardenUpdate : null
}

export async function deleteUpdate(id: number): Promise<boolean> {
  const { error } = await supabase.from('updates').delete().eq('id', id)

  if (error) {
    console.error('Error deleting update:', error)
    return false
  }

  return true
}

export async function uploadMedia(file: File): Promise<string | null> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}.${fileExt}`
  const filePath = `${fileName}`

  const { data, error } = await supabase.storage.from('media').upload(filePath, file)

  if (error) {
    console.error('Error uploading file:', error)
    return null
  }

  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath)

  return publicUrl
}

// =====================================================
// GARDENS CRUD
// =====================================================

export async function getGardens(): Promise<Garden[]> {
  const { data, error } = await supabase
    .from('gardens')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching gardens:', error)
    return []
  }

  return data || []
}

export async function createGarden(name: string): Promise<Garden | null> {
  const { data, error } = await supabase
    .from('gardens')
    .insert([{ name }])
    .select()

  if (error) {
    console.error('Error creating garden:', error)
    return null
  }

  return data && data.length > 0 ? data[0] : null
}

// =====================================================
// PLANT TYPES CRUD
// =====================================================

export async function getPlantTypes(): Promise<PlantType[]> {
  const { data, error } = await supabase
    .from('plant_types')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching plant types:', error)
    return []
  }

  return data || []
}

export async function createPlantType(name: string): Promise<PlantType | null> {
  const { data, error } = await supabase
    .from('plant_types')
    .insert([{ name }])
    .select()

  if (error) {
    console.error('Error creating plant type:', error)
    return null
  }

  return data && data.length > 0 ? data[0] : null
}

// =====================================================
// PLANTS CRUD
// =====================================================

// Helper to extract name from Supabase JOIN response (could be array or object)
const extractName = (value: any): string | undefined => {
  if (!value) return undefined
  if (Array.isArray(value)) {
    return value[0]?.name
  }
  return value.name
}

export async function getPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from('plants')
    .select(`
      id,
      garden_id,
      plant_type_id,
      plant_name,
      created_at,
      gardens!inner(name),
      plant_types!inner(name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching plants:', error)
    return []
  }

  // Map database response to Plant interface
  return (data || []).map((item: any) => ({
    id: item.id,
    gardenId: item.garden_id,
    plantTypeId: item.plant_type_id,
    plantName: item.plant_name,
    gardenName: extractName(item.gardens),
    plantTypeName: extractName(item.plant_types),
    created_at: item.created_at,
  }))
}

export async function getPlantsByGarden(gardenId: number): Promise<Plant[]> {
  const { data, error } = await supabase
    .from('plants')
    .select(`
      id,
      garden_id,
      plant_type_id,
      plant_name,
      created_at,
      gardens!inner(name),
      plant_types!inner(name)
    `)
    .eq('garden_id', gardenId)
    .order('plant_name')

  if (error) {
    console.error('Error fetching plants by garden:', error)
    return []
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    gardenId: item.garden_id,
    plantTypeId: item.plant_type_id,
    plantName: item.plant_name,
    gardenName: extractName(item.gardens),
    plantTypeName: extractName(item.plant_types),
    created_at: item.created_at,
  }))
}

export async function createPlant(plant: Omit<Plant, 'id' | 'gardenName' | 'plantTypeName' | 'created_at'>): Promise<Plant | null> {
  const { data, error } = await supabase
    .from('plants')
    .insert([{
      garden_id: plant.gardenId,
      plant_type_id: plant.plantTypeId,
      plant_name: plant.plantName,
    }])
    .select(`
      id,
      garden_id,
      plant_type_id,
      plant_name,
      created_at,
      gardens!inner(name),
      plant_types!inner(name)
    `)

  if (error) {
    console.error('Error creating plant:', error)
    return null
  }

  if (data && data.length > 0) {
    const item = data[0]
    return {
      id: item.id,
      gardenId: item.garden_id,
      plantTypeId: item.plant_type_id,
      plantName: item.plant_name,
      gardenName: extractName(item.gardens),
      plantTypeName: extractName(item.plant_types),
      created_at: item.created_at,
    }
  }

  return null
}

export async function updatePlant(id: number, plant: Partial<Omit<Plant, 'id' | 'gardenName' | 'plantTypeName' | 'created_at'>>): Promise<Plant | null> {
  const dbData: any = {}
  if (plant.gardenId !== undefined) dbData.garden_id = plant.gardenId
  if (plant.plantTypeId !== undefined) dbData.plant_type_id = plant.plantTypeId
  if (plant.plantName !== undefined) dbData.plant_name = plant.plantName

  const { data, error } = await supabase
    .from('plants')
    .update(dbData)
    .eq('id', id)
    .select(`
      id,
      garden_id,
      plant_type_id,
      plant_name,
      created_at,
      gardens!inner(name),
      plant_types!inner(name)
    `)

  if (error) {
    console.error('Error updating plant:', error)
    return null
  }

  if (data && data.length > 0) {
    const item = data[0]
    return {
      id: item.id,
      gardenId: item.garden_id,
      plantTypeId: item.plant_type_id,
      plantName: item.plant_name,
      gardenName: extractName(item.gardens),
      plantTypeName: extractName(item.plant_types),
      created_at: item.created_at,
    }
  }

  return null
}

export async function deletePlant(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('plants')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting plant:', error)
    return false
  }

  return true
}
