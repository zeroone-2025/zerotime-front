import type { CapacitorConfig } from '@capacitor/cli';

function isLocalDevelopmentHost(hostname: string): boolean {
    const normalized = hostname.replace(/^\[|\]$/g, '');
    if (
        normalized === 'localhost' ||
        normalized.endsWith('.localhost') ||
        normalized === '127.0.0.1' ||
        normalized === '::1'
    ) {
        return true;
    }

    const octets = normalized.split('.');
    if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) {
        return false;
    }

    const [first, second, third, fourth] = octets.map(Number);
    if ([first, second, third, fourth].some((octet) => octet > 255)) {
        return false;
    }
    return (
        first === 10 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
    );
}

function localDevelopmentNavigationOrigin(): string | null {
    if (
        process.env.CAPACITOR_LOCAL_DEV !== 'true' ||
        process.env.CAPACITOR_LOCAL_DEV_MODE !== 'local' ||
        (process.env.CAPACITOR_BUILD !== undefined && process.env.CAPACITOR_BUILD !== 'false') ||
        process.env.NEXT_PUBLIC_MOBILE_RELEASE_PLANE !== undefined
    ) {
        return null;
    }

    const origin = process.env.CAPACITOR_LOCAL_DEV_ORIGIN;
    if (origin === undefined) {
        return null;
    }

    try {
        const parsed = new URL(origin);
        if (
            parsed.protocol !== 'http:' ||
            parsed.port === '' ||
            parsed.username !== '' ||
            parsed.password !== '' ||
            parsed.pathname !== '/' ||
            parsed.search !== '' ||
            parsed.hash !== '' ||
            !isLocalDevelopmentHost(parsed.hostname)
        ) {
            return null;
        }
        return parsed.origin;
    } catch {
        return null;
    }
}

const localDevelopmentOrigin = localDevelopmentNavigationOrigin();

const config: CapacitorConfig = {
    appId: 'kr.zerotime.app',
    appName: '제로타임 - 전북대 공지 알리미',
    webDir: 'out',
    server: {
        androidScheme: 'https',
        iosScheme: 'https',
        cleartext: localDevelopmentOrigin !== null,
        allowNavigation: localDevelopmentOrigin === null ? [] : [localDevelopmentOrigin],
    },
    android: {
        allowMixedContent: localDevelopmentOrigin !== null,
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
