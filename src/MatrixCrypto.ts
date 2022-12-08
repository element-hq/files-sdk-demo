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
import type { IKeyBackupInfo, IKeyBackupRestoreResult } from 'matrix-js-sdk/lib/crypto/keybackup';
import type { TrustInfo } from 'matrix-js-sdk/lib/crypto/backup';
import EventEmitter from "events";
import { CryptoEvent } from "matrix-js-sdk/lib/crypto";

export type { IKeyBackupInfo } from 'matrix-js-sdk/lib/crypto/keybackup';

export class MatrixCrypto extends EventEmitter {
    constructor(private client: MatrixClient) {
        super();
        client.on(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatus);
    }

    async init(): Promise<void> {
        await this.client.initCrypto();

        this.client.setCryptoTrustCrossSignedDevices(true);

        const userId = this.client.getUserId();
        if (userId) {
            await this.client.downloadKeys([userId]);
        }

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

        // The semantics here look odd:
        // First we try and restore with the password which will throw an error if the password is wrong
        // Then we actually test to see if the backup was usable and throw an error if not

        const restoreResult = await this.client.restoreKeyBackupWithPassword(
            passphrase,
            undefined,
            undefined,
            keyBackup,
            {},
        );

        const trustInfo = await this.client.isKeyBackupTrusted(keyBackup);

        return { restoreResult, trustInfo };
    }

    isConnectedToKeyBackup(): boolean {
        return !!this.client.getKeyBackupEnabled();
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