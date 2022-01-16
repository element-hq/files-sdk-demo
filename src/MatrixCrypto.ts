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

import type { MatrixClient } from "matrix-js-sdk/lib";
import type { ICurve25519AuthData, IKeyBackupInfo, IKeyBackupRestoreResult } from 'matrix-js-sdk/lib/crypto/keybackup';
import { Curve25519, type TrustInfo } from 'matrix-js-sdk/lib/crypto/backup';
import EventEmitter from "events";

export type { IKeyBackupInfo } from 'matrix-js-sdk/lib/crypto/keybackup';

export class MatrixCrypto extends EventEmitter {
    constructor(private client: MatrixClient) {
        super();
        client.on('crypto.keyBackupStatus', this.onKeyBackupStatus);
    }

    async init(): Promise<void> {
        await this.client.initCrypto();

        this.client.setCryptoTrustCrossSignedDevices(true);

        await this.client.downloadKeys([this.client.getUserId()]);

        // We don't support verifications at the moment.
        this.client.setGlobalErrorOnUnknownDevices(false);
    }

    async isKeyBackupAvailable(): Promise<boolean> {
        return !!(await this.client.getKeyBackupVersion());
    }

    async getKeyBackupInfo(): Promise<IKeyBackupInfo | null> {
        return this.client.getKeyBackupVersion();
    }

    async connectToExistingKeyBackup(
        passphrase: string,
    ): Promise<{ restoreResult: IKeyBackupRestoreResult, trustInfo: TrustInfo }> {
        const keyBackup = await this.client.getKeyBackupVersion();
        if (!keyBackup) {
            throw new Error('No key backup available');
        }

        if (!this.client.crypto.sessionStore.getLocalTrustedBackupPubKey()
            && keyBackup.algorithm === Curve25519.algorithmName) {
            // derive public key from private and store as trusted
            const privateKey = await this.client.keyBackupKeyFromPassword(passphrase, keyBackup);
            const [, authData] = await Curve25519.prepare(privateKey);
            await this.client.crypto.setTrustedBackupPubKey((authData as ICurve25519AuthData).public_key);
            const trustInfo = await this.client.isKeyBackupTrusted(keyBackup);
            // if it turns out that it doesn't match then clear it out:
            if (!trustInfo.usable) {
                await this.client.crypto.setTrustedBackupPubKey('');
            }
        }

        // The semantics here look odd:
        // First we try and restore with the password which will throw an error if the password is wrong
        // Then we actually test to see if the backup was usable and throw an error if not

        const restoreResult = await this.client.restoreKeyBackupWithPassword(
            passphrase,
            undefined as unknown as string, // TODO: fix once matrix-js-sdk has corrected types
            undefined as unknown as string, // TODO: fix once matrix-js-sdk has corrected types
            keyBackup,
            {},
        );

        const trustInfo = await this.client.isKeyBackupTrusted(keyBackup);

        return { restoreResult, trustInfo };
    }

    isConnectedToKeyBackup(): boolean {
        return this.client.getKeyBackupEnabled();
    }

    async createNewKeyBackup(passphrase: string): Promise<string> {
        const keyInfo = await this.client.prepareKeyBackupVersion(passphrase);
        await this.client.createKeyBackupVersion(keyInfo);
        return keyInfo.recovery_key;
    }


    private onKeyBackupStatus(enabled: boolean) {
        this.emit('keyBackupStatus', this, enabled);
    }
}