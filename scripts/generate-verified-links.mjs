import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const APPLE_TEAM_ID_ENV = "MOBILE_RELEASE_APPLE_TEAM_ID";
export const ANDROID_CERT_FINGERPRINTS_ENV =
  "MOBILE_RELEASE_ANDROID_CERT_SHA256_FINGERPRINTS";
export const MOBILE_BUNDLE_ID = "kr.zerotime.app";
export const NATIVE_CALLBACK_PATH = "/auth/native/callback/";

const appleAppSiteAssociationPath = resolve(
  rootDirectory,
  "public/.well-known/apple-app-site-association",
);
const androidAssetLinksPath = resolve(
  rootDirectory,
  "public/.well-known/assetlinks.json",
);
const APPLE_TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const ANDROID_CERT_FINGERPRINT_PATTERN = /^[A-F0-9]{2}(?::[A-F0-9]{2}){31}$/;

function requiredEnvironmentValue(environment, name, description) {
  const value = environment[name];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required: ${description}`);
  }

  return value;
}

export function readVerifiedLinkInputs(environment = process.env) {
  const appleTeamId = requiredEnvironmentValue(
    environment,
    APPLE_TEAM_ID_ENV,
    "provide the real 10-character uppercase Apple Developer Team ID.",
  );

  if (!APPLE_TEAM_ID_PATTERN.test(appleTeamId)) {
    throw new Error(
      `${APPLE_TEAM_ID_ENV} must be exactly 10 uppercase letters or digits.`,
    );
  }

  const fingerprintsValue = requiredEnvironmentValue(
    environment,
    ANDROID_CERT_FINGERPRINTS_ENV,
    "provide one or more real Android signing certificate SHA-256 fingerprints.",
  );
  const fingerprints = fingerprintsValue.split(",");

  if (
    fingerprints.some(
      (fingerprint) => !ANDROID_CERT_FINGERPRINT_PATTERN.test(fingerprint),
    )
  ) {
    throw new Error(
      `${ANDROID_CERT_FINGERPRINTS_ENV} must be a comma-separated list of uppercase colon-delimited SHA-256 fingerprints with no whitespace.`,
    );
  }

  const uniqueFingerprints = [...new Set(fingerprints)];

  if (uniqueFingerprints.length !== fingerprints.length) {
    throw new Error(`${ANDROID_CERT_FINGERPRINTS_ENV} must not contain duplicates.`);
  }

  return {
    appleTeamId,
    androidCertificateFingerprints: uniqueFingerprints.sort(),
  };
}

export function getVerifiedLinkAssets(environment = process.env) {
  const { appleTeamId, androidCertificateFingerprints } =
    readVerifiedLinkInputs(environment);
  const appleAppSiteAssociation = {
    applinks: {
      details: [
        {
          appID: `${appleTeamId}.${MOBILE_BUNDLE_ID}`,
          paths: [NATIVE_CALLBACK_PATH],
        },
      ],
    },
  };
  const androidAssetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: MOBILE_BUNDLE_ID,
        sha256_cert_fingerprints: androidCertificateFingerprints,
      },
      relation_extensions: {
        "delegate_permission/common.handle_all_urls": {
          dynamic_app_link_components: [
            {
              "/": NATIVE_CALLBACK_PATH,
            },
          ],
        },
      },
    },
  ];

  return [
    {
      label: "Apple App Site Association",
      path: appleAppSiteAssociationPath,
      content: `${JSON.stringify(appleAppSiteAssociation, null, 2)}\n`,
    },
    {
      label: "Android Digital Asset Links",
      path: androidAssetLinksPath,
      content: `${JSON.stringify(androidAssetLinks, null, 2)}\n`,
    },
  ];
}

export async function generateVerifiedLinkAssets(environment = process.env) {
  const assets = getVerifiedLinkAssets(environment);

  await Promise.all(
    assets.map(async ({ path, content }) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf8");
    }),
  );

  return assets;
}

async function main() {
  const assets = await generateVerifiedLinkAssets();

  console.log(
    `Verified-link assets generated:\n${assets.map(({ path }) => path).join("\n")}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Verified-link generation failed: ${message}`);
    process.exitCode = 1;
  });
}
