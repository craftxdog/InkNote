import type { Registration } from '../plugins/plugin.types';

export type ConfigValue = boolean | number | string;

export type ConfigSnapshot = Readonly<Record<string, ConfigValue>>;

export type ConfigChange = Readonly<{
  key: string;
  value: ConfigValue;
}>;

export type ConfigValueChange<T extends ConfigValue = ConfigValue> = Readonly<{
  oldValue: T;
  newValue: T;
}>;

export type BooleanConfigSetting = Readonly<{
  type: 'boolean';
  default: boolean;
  title?: string;
}>;

export type StringConfigSetting = Readonly<{
  type: 'string';
  default: string;
  title?: string;
}>;

export type IntegerConfigSetting = Readonly<{
  type: 'integer';
  default: number;
  minimum?: number;
  maximum?: number;
  title?: string;
}>;

export type NumberConfigSetting = Readonly<{
  type: 'number';
  default: number;
  minimum?: number;
  maximum?: number;
  title?: string;
}>;

export type ConfigSetting =
  | BooleanConfigSetting
  | StringConfigSetting
  | IntegerConfigSetting
  | NumberConfigSetting;

export type ConfigSchema = Readonly<Record<string, ConfigSetting>>;

export type ConfigSettingValue<Setting extends ConfigSetting> =
  Setting extends BooleanConfigSetting
    ? boolean
    : Setting extends StringConfigSetting
      ? string
      : number;

export type ConfigSettingInput<Setting extends ConfigSetting> = Setting extends
  IntegerConfigSetting | NumberConfigSetting
  ? ConfigSettingValue<Setting> | string
  : ConfigSettingValue<Setting>;

export type ScopedConfig<S extends ConfigSchema = ConfigSchema> = Readonly<{
  get<Key extends keyof S & string>(key: Key): ConfigSettingValue<S[Key]>;
  set<Key extends keyof S & string>(
    key: Key,
    value: ConfigSettingInput<S[Key]>,
  ): Promise<ConfigSettingValue<S[Key]>>;
  observe<Key extends keyof S & string>(
    key: Key,
    listener: (value: ConfigSettingValue<S[Key]>) => void,
  ): Registration;
  onDidChange<Key extends keyof S & string>(
    key: Key,
    listener: (change: ConfigValueChange<ConfigSettingValue<S[Key]>>) => void,
  ): Registration;
}>;

export const isConfigValue = (value: unknown): value is ConfigValue =>
  typeof value === 'boolean' ||
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value));
