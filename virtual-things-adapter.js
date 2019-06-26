/**
 *
 * VirtualThingsAdapter - an adapter for trying out virtual things
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const child_process = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const {
  Adapter,
  Database,
  Device,
  Event,
  Property,
} = require('gateway-addon');
const mkdirp = require('mkdirp');
const os = require('os');
const path = require('path');
const uuid = require('uuid/v4');

const DEBUG = false;

const proc = child_process.spawnSync(
  'ffmpeg',
  ['-version'],
  {encoding: 'utf8'}
);
let ffmpegMajor = null, ffmpegMinor = null;
if (proc.status === 0) {
  const version = proc.stdout.split('\n')[0].split(' ')[2];
  ffmpegMajor = parseInt(version.split('.')[0], 10);
  ffmpegMinor = parseInt(version.split('.')[1], 10);
}

function getMediaPath() {
  let profileDir;
  if (process.env.hasOwnProperty('MOZIOT_HOME')) {
    profileDir = process.env.MOZIOT_HOME;
  } else {
    profileDir = path.join(os.homedir(), '.mozilla-iot');
  }

  return path.join(profileDir, 'media', 'virtual-things');
}

function randomNumber(integer, min, max) {
  if (typeof min === 'number' && typeof max === 'number') {
    if (integer) {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    return Math.random() * (max - min) + min;
  }

  const value = Math.random();

  if (integer) {
    return Math.floor(value);
  }

  return value;
}

function bool() {
  return {
    name: 'on',
    value: false,
    metadata: {
      title: 'On/Off',
      type: 'boolean',
      '@type': 'BooleanProperty',
      readOnly: true,
    },
  };
}

function on() {
  return {
    name: 'on',
    value: false,
    metadata: {
      title: 'On/Off',
      type: 'boolean',
      '@type': 'OnOffProperty',
    },
  };
}

function color() {
  return {
    name: 'color',
    value: '#ffffff',
    metadata: {
      title: 'Color',
      type: 'string',
      '@type': 'ColorProperty',
    },
  };
}

function colorTemperature() {
  return {
    name: 'colorTemperature',
    value: 2500,
    metadata: {
      title: 'Color Temperature',
      type: 'number',
      '@type': 'ColorTemperatureProperty',
      unit: 'kelvin',
      minimum: 2500,
      maximum: 9000,
    },
  };
}

function brightness() {
  return {
    name: 'level',
    value: 0,
    metadata: {
      title: 'Brightness',
      type: 'number',
      '@type': 'BrightnessProperty',
      unit: 'percent',
      minimum: 0,
      maximum: 100,
    },
  };
}

function level(readOnly) {
  return {
    name: 'level',
    value: 0,
    metadata: {
      title: 'Level',
      type: 'number',
      '@type': 'LevelProperty',
      unit: 'percent',
      minimum: 0,
      maximum: 100,
      readOnly,
    },
  };
}

const onOffColorLight = {
  type: 'onOffColorLight',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'Light', 'ColorControl'],
  name: 'Virtual On/Off Color Light',
  properties: [
    on(),
    color(),
  ],
  actions: [],
  events: [],
};

const onOffColorTemperatureLight = {
  type: 'onOffColorLight',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'Light', 'ColorControl'],
  name: 'Virtual On/Off Color Temperature Light',
  properties: [
    on(),
    colorTemperature(),
  ],
  actions: [],
  events: [],
};

const dimmableColorLight = {
  type: 'dimmableColorLight',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'Light', 'ColorControl'],
  name: 'Virtual Dimmable Color Light',
  properties: [
    color(),
    brightness(),
    on(),
  ],
  actions: [],
  events: [],
};

const multiLevelSwitch = {
  type: 'multiLevelSwitch',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'MultiLevelSwitch'],
  name: 'Virtual Multi-level Switch',
  properties: [
    level(false),
    on(),
  ],
  actions: [],
  events: [],
};

const onOffSwitch = {
  type: 'onOffSwitch',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch'],
  name: 'Virtual On/Off Switch',
  properties: [
    on(),
  ],
  actions: [],
  events: [],
};

const binarySensor = {
  type: 'binarySensor',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['BinarySensor'],
  name: 'Virtual Binary Sensor',
  properties: [
    bool(),
  ],
  actions: [],
  events: [],
};

const multiLevelSensor = {
  type: 'multiLevelSensor',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['MultiLevelSensor'],
  name: 'Virtual Multi-level Sensor',
  properties: [
    bool(),
    level(true),
  ],
  actions: [],
  events: [],
};

const smartPlug = {
  type: 'smartPlug',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'EnergyMonitor', 'SmartPlug', 'MultiLevelSwitch'],
  name: 'Virtual Smart Plug',
  properties: [
    on(),
    level(false),
    {
      name: 'instantaneousPower',
      value: 0,
      metadata: {
        '@type': 'InstantaneousPowerProperty',
        title: 'Power',
        type: 'number',
        unit: 'watt',
      },
    },
    {
      name: 'voltage',
      value: 0,
      metadata: {
        '@type': 'VoltageProperty',
        title: 'Voltage',
        type: 'number',
        unit: 'volt',
      },
    },
    {
      name: 'current',
      value: 0,
      metadata: {
        '@type': 'CurrentProperty',
        title: 'Current',
        type: 'number',
        unit: 'ampere',
      },
    },
    {
      name: 'frequency',
      value: 0,
      metadata: {
        '@type': 'FrequencyProperty',
        title: 'Frequency',
        type: 'number',
        unit: 'hertz',
      },
    },
  ],
  actions: [],
  events: [],
};

const onOffLight = {
  type: 'onOffLight',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'Light'],
  name: 'Virtual On/Off Light',
  properties: [
    on(),
  ],
  actions: [],
  events: [],
};

const dimmableLight = {
  type: 'dimmableLight',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'Light'],
  name: 'Virtual Dimmable Light',
  properties: [
    on(),
    brightness(),
  ],
  actions: [],
  events: [],
};

const doorSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['DoorSensor'],
  name: 'Virtual Door Sensor',
  properties: [
    {
      name: 'open',
      value: false,
      metadata: {
        title: 'Open',
        type: 'boolean',
        '@type': 'OpenProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const motionSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['MotionSensor'],
  name: 'Virtual Motion Sensor',
  properties: [
    {
      name: 'motion',
      value: false,
      metadata: {
        title: 'Motion',
        type: 'boolean',
        '@type': 'MotionProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const leakSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['LeakSensor'],
  name: 'Virtual Leak Sensor',
  properties: [
    {
      name: 'leak',
      value: false,
      metadata: {
        title: 'Leak',
        type: 'boolean',
        '@type': 'LeakProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const temperatureSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['TemperatureSensor'],
  name: 'Virtual Temperature Sensor',
  properties: [
    {
      name: 'temperature',
      value: 20,
      metadata: {
        title: 'Temperature',
        type: 'number',
        '@type': 'TemperatureProperty',
        unit: 'degree celsius',
        minimum: -20,
        maximum: 50,
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const pushButton = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['PushButton'],
  name: 'Virtual Push Button',
  properties: [
    {
      name: 'pushed',
      value: false,
      metadata: {
        title: 'Pushed',
        type: 'boolean',
        '@type': 'PushedProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const thing = {
  type: 'thing',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': [],
  name: 'Virtual Thing',
  properties: [
    {
      name: 'boolProperty',
      value: true,
      metadata: {
        type: 'boolean',
      },
    },
    {
      name: 'stringProperty',
      value: 'blah',
      metadata: {
        type: 'string',
      },
    },
    {
      name: 'numberProperty',
      value: 12,
      metadata: {
        type: 'number',
      },
    },
    {
      name: 'numberUnitProperty',
      value: 34,
      metadata: {
        type: 'number',
        unit: 'metres',
      },
    },
    {
      name: 'numberUnitMinMaxProperty',
      value: 56,
      metadata: {
        type: 'number',
        unit: 'degrees',
        minimum: 0,
        maximum: 100,
      },
    },
    {
      name: 'numberEnumProperty',
      value: 0,
      metadata: {
        type: 'number',
        unit: 'something',
        enum: [
          0,
          10,
          20,
          30,
        ],
      },
    },
    {
      name: 'stringEnumProperty',
      value: 'string1',
      metadata: {
        type: 'string',
        enum: [
          'string1',
          'string2',
          'string3',
          'string4',
        ],
      },
    },
  ],
  actions: [],
  events: [],
};

const actionsEventsThing = {
  type: 'thing',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': [],
  name: 'Virtual Actions & Events Thing',
  properties: [],
  actions: [
    {
      name: 'basic',
      metadata: {
        title: 'No Input',
        description: 'An action with no inputs, fires an event',
      },
    },
    {
      name: 'single',
      metadata: {
        title: 'Single Input',
        description: 'An action with a single, non-object input',
        input: {
          type: 'number',
        },
      },
    },
    {
      name: 'multiple',
      metadata: {
        title: 'Multiple Inputs',
        description: 'An action with mutiple, optional inputs',
        input: {
          type: 'object',
          properties: {
            stringInput: {
              type: 'string',
            },
            booleanInput: {
              type: 'boolean',
            },
          },
        },
      },
    },
    {
      name: 'advanced',
      metadata: {
        title: 'Advanced Inputs',
        description: 'An action with many inputs, some required',
        input: {
          type: 'object',
          required: [
            'numberInput',
          ],
          properties: {
            numberInput: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              unit: 'percent',
            },
            integerInput: {
              type: 'integer',
              unit: 'meters',
            },
            stringInput: {
              type: 'string',
            },
            booleanInput: {
              type: 'boolean',
            },
            enumInput: {
              type: 'string',
              enum: [
                'enum string1',
                'enum string2',
                'enum string3',
              ],
            },
          },
        },
      },
    },
  ],
  events: [
    {
      name: 'virtualEvent',
      metadata: {
        description: 'An event from a virtual thing',
        type: 'number',
      },
    },
  ],
};

const onOffSwitchWithPin = {
  type: 'onOffSwitch',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch'],
  name: 'Virtual On/Off Switch (with PIN)',
  properties: [
    on(),
  ],
  actions: [],
  events: [],
  pin: {
    required: true,
    pattern: '^\\d{4}$',
  },
};

const onOffSwitchWithCredentials = {
  type: 'onOffSwitch',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch'],
  name: 'Virtual On/Off Switch (with credentials)',
  properties: [
    on(),
  ],
  actions: [],
  events: [],
  credentialsRequired: true,
};

const camera = {
  type: 'thing',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['Camera'],
  name: 'Virtual Camera',
  properties: [
    {
      name: 'image',
      value: null,
      metadata: {
        type: 'null',
        '@type': 'ImageProperty',
        title: 'Image',
        readOnly: true,
        links: [
          {
            rel: 'alternate',
            href: '/media/virtual-things/image.png',
            mediaType: 'image/png',
          },
        ],
      },
    },
  ],
  actions: [],
  events: [],
};

const videoCamera = {
  type: 'thing',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['VideoCamera'],
  name: 'Virtual Video Camera',
  properties: [
    {
      name: 'video',
      value: null,
      metadata: {
        type: 'null',
        '@type': 'VideoProperty',
        title: 'Video',
        readOnly: true,
        links: [
          {
            rel: 'alternate',
            href: '/media/virtual-things/index.mpd',
            mediaType: 'application/dash+xml',
          },
        ],
      },
    },
  ],
  actions: [],
  events: [],
};

const alarm = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['Alarm'],
  name: 'Virtual Alarm',
  properties: [
    {
      name: 'alarm',
      value: false,
      metadata: {
        title: 'Alarm',
        type: 'boolean',
        '@type': 'AlarmProperty',
      },
    },
  ],
  actions: [
    {
      name: 'trigger',
      metadata: {
        title: 'Trigger',
        description: 'Trigger alarm',
      },
    },
    {
      name: 'silence',
      metadata: {
        title: 'Silence',
        description: 'Silence alarm',
      },
    },
  ],
  events: [
    {
      name: 'alarmEvent',
      metadata: {
        description: 'An alarm event from a virtual thing',
        type: 'string',
        '@type': 'AlarmEvent',
        readOnly: true,
      },
    },
  ],
};

const energyMonitor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['EnergyMonitor'],
  name: 'Virtual Energy Monitor',
  properties: [
    {
      name: 'instantaneousPower',
      value: 0,
      metadata: {
        '@type': 'InstantaneousPowerProperty',
        title: 'Power',
        type: 'number',
        unit: 'watt',
      },
    },
    {
      name: 'voltage',
      value: 0,
      metadata: {
        '@type': 'VoltageProperty',
        title: 'Voltage',
        type: 'number',
        unit: 'volt',
      },
    },
    {
      name: 'current',
      value: 0,
      metadata: {
        '@type': 'CurrentProperty',
        title: 'Current',
        type: 'number',
        unit: 'ampere',
      },
    },
    {
      name: 'frequency',
      value: 0,
      metadata: {
        '@type': 'FrequencyProperty',
        title: 'Frequency',
        type: 'number',
        unit: 'hertz',
      },
    },
  ],
  actions: [],
  events: [],
};

const colorControl = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['ColorControl'],
  name: 'Virtual Color Control',
  properties: [
    color(),
  ],
  actions: [],
  events: [],
};

if (ffmpegMajor !== null && ffmpegMajor >= 4) {
  videoCamera.properties[0].metadata.links.push({
    rel: 'alternate',
    href: '/media/virtual-things/master.m3u8',
    mediaType: 'application/vnd.apple.mpegurl',
  });
}

const VIRTUAL_THINGS = [
  onOffColorLight,
  multiLevelSwitch,
  dimmableColorLight,
  onOffSwitch,
  binarySensor,
  multiLevelSensor,
  smartPlug,
  onOffLight,
  dimmableLight,
  thing,
  actionsEventsThing,
  onOffSwitchWithPin,
  onOffColorTemperatureLight,
  doorSensor,
  motionSensor,
  pushButton,
  leakSensor,
  temperatureSensor,
  onOffSwitchWithCredentials,
  camera,
  videoCamera,
  alarm,
  energyMonitor,
  colorControl,
];

/**
 * A virtual property
 */
class VirtualThingsProperty extends Property {
  constructor(device, name, descr, value) {
    super(device, name, descr);
    this.setCachedValue(value);

    if (device.adapter.randomizePropertyValues) {
      this.interval = setInterval(() => {
        let value;

        switch (descr.type) {
          case 'boolean':
            value = Math.random() >= 0.5;
            break;
          case 'string': {
            if (descr['@type'] === 'ColorProperty') {
              const randomComponent = () => {
                return randomNumber(true, 0, 255).toString(16).padStart(2, '0');
              };
              value =
                `#${randomComponent()}${randomComponent()}${randomComponent()}`;
            } else {
              value = crypto.randomBytes(20).toString('hex');
            }

            break;
          }
          case 'number':
          case 'integer':
            value = randomNumber(
              descr.type === 'integer',
              descr.minimum,
              descr.maximum
            );
            break;
          default:
            return;
        }

        if (value !== this.value) {
          this.setCachedValue(value);
          this.device.notifyPropertyChanged(this);
        }
      }, 30 * 1000);
    }
  }

  /**
   * @param {any} value
   * @return {Promise} a promise which resolves to the updated value.
   */
  setValue(value) {
    return new Promise((resolve, reject) => {
      if (this.readOnly) {
        reject('Read-only property');
      } else {
        this.setCachedValue(value);
        resolve(this.value);
        this.device.notifyPropertyChanged(this);
      }
    });
  }
}

/**
 * A virtual device
 */
class VirtualThingsDevice extends Device {
  /**
   * @param {VirtualThingsAdapter} adapter
   * @param {String} id - A globally unique identifier
   * @param {Object} template - the virtual thing to represent
   */
  constructor(adapter, id, template) {
    super(adapter, id);

    this.name = template.name;

    this.type = template.type;
    this['@context'] = template['@context'];
    this['@type'] = template['@type'];

    if (template.hasOwnProperty('pin')) {
      this.pinRequired = template.pin.required;
      this.pinPattern = template.pin.pattern;
    } else {
      this.pinRequired = false;
      this.pinPattern = false;
    }

    this.credentialsRequired = !!template.credentialsRequired;

    for (const prop of template.properties) {
      this.properties.set(
        prop.name,
        new VirtualThingsProperty(this, prop.name, prop.metadata, prop.value));
    }

    for (const action of template.actions) {
      this.addAction(action.name, action.metadata);
    }

    for (const event of template.events) {
      this.addEvent(event.name, event.metadata);
    }

    this.adapter.handleDeviceAdded(this);
  }

  performAction(action) {
    console.log(`Performing action "${action.name}" with input:`, action.input);

    action.start();

    switch (action.name) {
      case 'basic':
        this.eventNotify(new Event(this,
                                   'virtualEvent',
                                   Math.floor(Math.random() * 100)));
        break;
      case 'trigger': {
        const prop = this.properties.get('alarm');
        prop.setCachedValue(true);
        this.notifyPropertyChanged(prop);
        this.eventNotify(new Event(this,
                                   'alarmEvent',
                                   'Something happened!'));
        break;
      }
      case 'silence': {
        const prop = this.properties.get('alarm');
        prop.setCachedValue(false);
        this.notifyPropertyChanged(prop);
        break;
      }
    }

    action.finish();

    return Promise.resolve();
  }
}

/**
 * Virtual Things adapter
 * Instantiates one virtual device per template
 */
class VirtualThingsAdapter extends Adapter {
  constructor(adapterManager, manifest) {
    super(adapterManager, 'virtual-things', manifest.name);

    adapterManager.addAdapter(this);

    this.randomizePropertyValues =
      manifest.moziot.config.randomizePropertyValues;
    this.addAllThings();

    this.mediaDir = getMediaPath();
    if (!fs.existsSync(this.mediaDir)) {
      mkdirp.sync(this.mediaDir, {mode: 0o755});
    }

    this.copyImage();
    this.startTranscode();
  }

  copyImage() {
    const imagePath = path.join(this.mediaDir, 'image.png');

    if (!fs.existsSync(imagePath)) {
      const localImagePath = path.join(__dirname, 'static', 'image.png');
      fs.copyFileSync(localImagePath, imagePath);
    }
  }

  startTranscode() {
    if (ffmpegMajor === null) {
      return;
    }

    const videoPath = path.join(this.mediaDir, 'index.mpd');
    const localVideoPath = path.join(__dirname, 'static', 'video.mp4');

    const args = [
      '-y',
      '-re',
      '-stream_loop', '-1',
      '-i', localVideoPath,
      '-window_size', '5',
      '-extra_window_size', '10',
      '-use_template', '1',
      '-use_timeline', '1',
    ];

    if (ffmpegMajor >= 4) {
      args.push(
        '-streaming', '1',
        '-hls_playlist', '1'
      );
    }

    if (ffmpegMajor > 4 || (ffmpegMajor === 4 && ffmpegMinor >= 1)) {
      args.push(
        '-seg_duration', '2',
        '-dash_segment_type', 'mp4'
      );
    }

    args.push(
      '-remove_at_exit', '1',
      '-loglevel', 'quiet',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-f', 'dash',
      videoPath
    );

    this.transcodeProcess = child_process.spawn('ffmpeg', args);
    this.transcodeProcess.on('close', this.startTranscode.bind(this));
    this.transcodeProcess.on('error', console.error);
    this.transcodeProcess.stdout.on('data', (data) => {
      if (DEBUG) {
        console.log(`ffmpeg: ${data}`);
      }
    });
    this.transcodeProcess.stderr.on('data', (data) => {
      if (DEBUG) {
        console.error(`ffmpeg: ${data}`);
      }
    });
  }

  stopTranscode() {
    if (this.transcodeProcess) {
      this.transcodeProcess.kill();
      this.transcodeProcess = null;
    }
  }

  startPairing() {
    this.addAllThings();
  }

  addAllThings() {
    for (let i = 0; i < VIRTUAL_THINGS.length; i++) {
      const id = `virtual-things-${i}`;
      if (!this.devices[id]) {
        new VirtualThingsDevice(this, id, VIRTUAL_THINGS[i]);
      }
    }

    const db = new Database(this.packageName);
    db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      if (config.customThings) {
        for (const descr of config.customThings) {
          if (!descr.id) {
            descr.id = uuid();
          }

          const id = `virtual-things-custom-${descr.id}`;
          if (this.devices[id]) {
            continue;
          }

          for (const property of descr.properties) {
            // Clean up properties
            if (!['number', 'integer'].includes(property.type)) {
              delete property.unit;
              delete property.minimum;
              delete property.maximum;
            } else {
              if (!property.unit) {
                delete property.unit;
              }

              if (property.minimum === property.maximum) {
                delete property.minimum;
                delete property.maximum;
              }
            }

            switch (property.type) {
              case 'integer':
              case 'number':
                property.default = Number(property.default);
                break;
              case 'boolean':
                if (property.default === 'true') {
                  property.default = true;
                } else if (property.default === 'false') {
                  property.default = false;
                } else {
                  property.default = !!property.default;
                }
                break;
              case 'null':
                property.default = null;
                break;
              case 'string':
                // just in case
                property.default = `${property.default}`;
                break;
            }
          }

          const newDescr = {
            type: 'thing',
            '@context': descr['@context'] || 'https://iot.mozilla.org/schemas',
            '@type': descr['@type'] || [],
            name: descr.name,
            properties: [],
            actions: [],
            events: [],
          };

          for (const property of descr.properties) {
            const prop = {
              name: property.name,
              value: property.default,
              metadata: {
                title: property.title,
                type: property.type,
              },
            };

            if (property.description) {
              prop.metadata.description = property.description;
            }

            if (property['@type']) {
              prop.metadata['@type'] = property['@type'];
            }

            if (property.unit) {
              prop.metadata.unit = property.unit;
            }

            if (property.hasOwnProperty('minimum')) {
              prop.metadata.minimum = property.minimum;
            }

            if (property.hasOwnProperty('maximum')) {
              prop.metadata.maximum = property.maximum;
            }

            if (property.hasOwnProperty('multipleOf')) {
              prop.metadata.multipleOf = property.multipleOf;
            }

            if (property.hasOwnProperty('readOnly')) {
              prop.metadata.readOnly = property.readOnly;
            }

            newDescr.properties.push(prop);
          }

          new VirtualThingsDevice(this, id, newDescr);
        }

        return db.saveConfig(config);
      }
    }).catch((e) => {
      console.error('Database error:', e);
    }).then(() => {
      db.close();
    });
  }

  setPin(deviceId, pin) {
    return new Promise((resolve, reject) => {
      const device = this.getDevice(deviceId);
      if (device && device.pinRequired && pin === '1234') {
        resolve();
      } else {
        reject('Invalid PIN');
      }
    });
  }

  setCredentials(deviceId, username, password) {
    return new Promise((resolve, reject) => {
      const device = this.getDevice(deviceId);
      if (device && device.credentialsRequired && username === 'user' &&
          password === 'password') {
        resolve();
      } else {
        reject('Invalid credentials');
      }
    });
  }

  unload() {
    if (this.randomizePropertyValues) {
      for (const device of Object.values(this.devices)) {
        for (const property of device.properties.values()) {
          clearInterval(property.interval);
        }
      }
    }

    return super.unload();
  }
}

module.exports = VirtualThingsAdapter;

