import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'kr.zerotime.app',
    appName: '제로타임 - 전북대 공지 알리미',
    webDir: 'out',
    server: {
        // hostname 제거 -> localhost 사용 (Android 호환성 향상)
        androidScheme: 'https',
        iosScheme: 'https',
        cleartext: true,
        allowNavigation: [
            '*.zerotime.kr'
        ]
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 3000,
            backgroundColor: '#ffffff',
        },
        CapacitorCookies: {
            enabled: true,
        },
        CapacitorHttp: {
            enabled: true,
        },
    },
};

export default config;
