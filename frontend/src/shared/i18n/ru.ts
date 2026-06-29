import type { en } from './en';

type Translations = { [N in keyof typeof en]: { [K in keyof (typeof en)[N]]: string } };

export const ru: Translations = {
  common: {
    appName: 'kmb-video-chat',
    connecting: 'Подключение…',
    connectError: 'Не удалось подключиться к сервису звонков. Проверьте подключение к интернету и попробуйте снова.',
  },
  prejoin: {
    nameLabel: 'Ваше имя',
    nameHelp: '2–30 символов. Буквы, цифры, пробелы, дефисы и апострофы.',
    enterCall: 'Войти в звонок →',
    micToggle: 'Микрофон',
    cameraToggle: 'Камера',
    awaitingPermission: 'Разрешите доступ к камере и микрофону, чтобы продолжить.',
    nameEmpty: 'Пожалуйста, введите имя',
    nameLength: 'Имя должно содержать 2–30 символов',
    nameChars: 'Имя может содержать только буквы, цифры, пробелы, дефисы и апострофы',
    cameraDenied: 'Доступ к камере запрещён. Вы можете включить его в настройках браузера.',
    micDenied: 'Доступ к микрофону запрещён. Вы можете включить его в настройках браузера.',
    bothDenied: 'Доступ к камере и микрофону запрещён. Вы можете включить его в настройках браузера.',
  },
  call: {
    you: '{{name}} (Вы)',
    leave: 'Выйти',
    micToggle: 'Микрофон',
    cameraToggle: 'Камера',
  },
  roomStates: {
    fullTitle: 'Звонок заполнен.',
    fullBody: 'Одновременно могут участвовать только четыре человека.',
    backToHome: 'На главную',
  },
};
