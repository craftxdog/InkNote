export type WindowControlsApi = {
  setTrafficLightsVisible: (visible: boolean) => Promise<boolean>;
};

export type InknoteApi = {
  windowControls: WindowControlsApi;
};
