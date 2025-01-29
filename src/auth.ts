/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createClient as createClientImpl, type ICreateClientOpts } from 'matrix-js-sdk/lib';
import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store';
import { MatrixFiles } from 'matrix-files-sdk';

export async function getWellKnown(baseUrl: string): Promise<{ 'org.matrix.msc2965.authentication'? :{ issuer: string, account?: string }, 'm.homeserver'?: { base_url?: string } }> {
    const url = new URL(baseUrl);
    url.search = '';
    url.pathname = '/.well-known/matrix/client';
    const response = await fetch(url.href);
    return response.json();
} 

export async function getLoginFlows(baseUrl: string) {
    const tempClient = createClientImpl({ baseUrl });

    return tempClient.loginFlows() as Promise<{
        flows: [
            { type: string }
        ],
    }>;
}

export async function loginWithPassword(
    localStorage: Storage,
    homeserver: string,
    username: string,
    password: string,
): Promise<MatrixFiles> {
    const tempClient = createClientImpl({
        baseUrl: homeserver,
    });

    const res = await tempClient.loginWithPassword(username, password);
    const {
        access_token: accessToken,
        user_id: userId,
        well_known: wellKnown,
        device_id: deviceId,
    } = res;
    const baseUrl = wellKnown?.['m.homeserver']?.['base_url'] ?? homeserver;

    return createClient(localStorage, { baseUrl, accessToken, userId, deviceId });
}

export async function createFromToken(
    localStorage: Storage,
    homeserver: string,
    accessToken: string,
    userId?: string,
    deviceId?: string,
): Promise<MatrixFiles> {
    const files = await createClient(localStorage, { baseUrl: homeserver, accessToken, userId, deviceId });
    // used as a "ping" to spot connection errors
    await files.client.waitForClientWellKnown();
    return files;
}

export async function registerWithPassword(
    localStorage: Storage,
    homeserver: string,
    username: string,
    password: string,
): Promise<MatrixFiles> {
    const tempClient = createClientImpl({
        baseUrl: homeserver,
    });

    const res = await tempClient.register(username, password, null, { type: 'm.login.dummy' });
    const {
        access_token: accessToken,
        user_id: userId,
        device_id: deviceId,
    } = res;
    const wellKnown = await tempClient.waitForClientWellKnown();
    const baseUrl = wellKnown?.['m.homeserver']?.['base_url'] ?? homeserver;

    if (!accessToken) {
        throw new Error('No access token returned from registration');
    }

    return createFromToken(localStorage, baseUrl, accessToken, userId, deviceId);
}

export async function createClient(
    localStorage: Storage,
    options: ICreateClientOpts,
): Promise<MatrixFiles> {
    const cryptoStore = new LocalStorageCryptoStore(localStorage);

    await cryptoStore.startup();
    const client = createClientImpl({
        ...options,
        cryptoStore,
        useAuthorizationHeader: true, // presumably this is good practice
        // these are copied from files-sdk:
        cryptoCallbacks: {},
        timelineSupport: true, // for file management
    });

    return new MatrixFiles(client);
}
