import { create } from 'zustand'
import { fetchRooms, sortRooms, STUDIO_PLACEMENT, type RoomPlacement } from './roomFiles'
import { useAppStore } from './store'
import { isStandardEnvironment } from '../scene/look'

type RoomState = {
  rooms: RoomPlacement[]
  sceneHasLights: boolean
  setSceneHasLights: (value: boolean) => void
  refreshRooms: () => Promise<void>
}

function createRoomStore() {
  return create<RoomState>((set, get) => ({
    rooms: [],
    sceneHasLights: false,
    setSceneHasLights: (sceneHasLights) => set({ sceneHasLights }),
    refreshRooms: async () => {
      const incoming = await fetchRooms()
      if (!incoming) return
      set({ rooms: sortRooms(incoming) })
      const id = useAppStore.getState().environmentId
      if (!isStandardEnvironment(id) && !get().rooms.some((room) => room.id === id)) {
        useAppStore.getState().setEnvironmentId('studio')
      }
    },
  }))
}

type RoomStore = ReturnType<typeof createRoomStore>

const globalRooms = globalThis as typeof globalThis & { __noctureRoomStore?: RoomStore }

export const useRoomStore = globalRooms.__noctureRoomStore ?? createRoomStore()
globalRooms.__noctureRoomStore = useRoomStore

void useRoomStore.getState().refreshRooms()

export function usePlacement(): RoomPlacement {
  const id = useAppStore((s) => s.environmentId)
  const rooms = useRoomStore((s) => s.rooms)
  return rooms.find((room) => room.id === id) ?? STUDIO_PLACEMENT
}
