import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { askForUsername } from '@/composables/usernamePrompDialog'
import { eventCategoriesDefaultMapping } from '@/libs/slide-to-confirm'
import { reloadCockpit } from '@/libs/utils'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

import { useMainVehicleStore } from './mainVehicle'

export const useMissionStore = defineStore('mission', () => {
  const username = useStorage<string>('cockpit-username', '')
  const lastConnectedUser = localStorage.getItem('cockpit-last-connected-user') || undefined
  const missionName = ref('')
  const slideEventsEnabled = useBlueOsStorage('cockpit-slide-events-enabled', true)
  const slideEventsCategoriesRequired = useBlueOsStorage(
    'cockpit-slide-events-categories-required',
    eventCategoriesDefaultMapping
  )
  const lastMissionName = useStorage('cockpit-last-mission-name', '')
  const missionStartTime = useStorage('cockpit-mission-start-time', new Date())
  const { showDialog } = useInteractionDialog()

  const mainVehicleStore = useMainVehicleStore()

  watch(missionName, () => (lastMissionName.value = missionName.value))

  const currentPlanningWaypoints = reactive<Waypoint[]>([])

  const moveWaypoint = (id: string, newCoordinates: WaypointCoordinates): void => {
    const waypoint = currentPlanningWaypoints.find((w) => w.id === id)
    if (waypoint === undefined) {
      throw Error(`Could not move waypoint. No waypoint with id ${id} was found.`)
    }
    Object.assign(
      currentPlanningWaypoints,
      currentPlanningWaypoints.map((w) => (w.id === id ? { ...w, ...{ coordinates: newCoordinates } } : w))
    )
  }

  const changeUsername = async (): Promise<void> => {
    let newUsername: string | undefined
    try {
      newUsername = await askForUsername()
    } catch (error) {
      console.error('Username not set. User dismissed dialog.')
      return
    }
    console.debug('Username set:', newUsername)

    // If the user cancels the prompt or sets a name with less than 3 chars, do nothing
    if (!newUsername || newUsername.trim().length < 3) {
      showDialog({
        title: 'Invalid username',
        message: 'Username must be at least 3 characters long. No username was set. Auto-sync disabled.',
        variant: 'error',
        maxWidth: 560,
      })
      return
    }

    username.value = newUsername
    await reloadCockpit()
  }

  watch(
    () => mainVehicleStore.isVehicleOnline,
    async (newValue) => {
      if (newValue) {
        // If there's a username saved, assign it as the last connected user
        localStorage.setItem('cockpit-last-connected-user', username.value)
        console.log(`Last connected user set to ${username.value}.`)

        if (!username.value) {
          // If no username is set and vehicle is connected, ask the user to enter one
          await changeUsername()
        }
      }
    },
    { immediate: true }
  )

  return {
    username,
    lastConnectedUser,
    changeUsername,
    missionName,
    lastMissionName,
    missionStartTime,
    currentPlanningWaypoints,
    slideEventsEnabled,
    slideEventsCategoriesRequired,
    moveWaypoint,
  }
})
