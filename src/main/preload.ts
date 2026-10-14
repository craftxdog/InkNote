// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */

import { contextBridge, ipcRenderer } from 'electron';

import type { InknoteApi } from '../shared/bridge';
import { IPC_CHANNELS } from '../shared/ipc/channels';

const inknoteApi: InknoteApi = {
  windowControls: {
    setTrafficLightsVisible: async (visible: boolean) => {
      const result = await ipcRenderer.invoke(
        IPC_CHANNELS.window.setTrafficLightsVisibility,
        visible,
      );

      return Boolean(result);
    },
  },
};

// API propia de Inknote
contextBridge.exposeInMainWorld('inknote', inknoteApi);
