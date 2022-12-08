/*
Copyright 2021-2022 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { createClient as createClientImpl, type ICreateClientOpts } from 'matrix-js-sdk/lib';
import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store';
import { MatrixFiles } from 'matrix-files-sdk';

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
