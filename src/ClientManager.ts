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

import type { MatrixFiles } from "matrix-files-sdk";
import { loginWithPassword, createFromToken, registerWithPassword } from "./auth";
import { readValue, storeValue } from "./storage";
import { MatrixCrypto } from "./MatrixCrypto";
import { SimpleObservable } from "./external/SimpleObservable";

const defaultHomeserver = process.env.DEFAULT_HOMESERVER ?? 'http://localhost:8080';

export class ClientManager {
    private _files: MatrixFiles | undefined;
    private _crypto: MatrixCrypto | undefined;

    public readonly authedState = new SimpleObservable<boolean>(false);

    public homeserverUrl = readValue("homeserverUrl", defaultHomeserver);
    public accessToken = readValue<string>("accessToken", '');
    public deviceId = readValue<string>("deviceId", '');
    public userId = readValue<string>("userId", '');
    public password: string = '';
    public keyBackupPassphrase: string = '';

    public nextRoute: string | undefined;

    public get files(): MatrixFiles {
        if (!this._files) {
            throw new Error('No MatrixFiles connected');
        }
        return this._files;
    }

    public get client() {
        if (!this._files) {
            throw new Error('No MatrixFiles connected');
        }
        return this._files.getClient();
    }

    public get crypto() {
        if (!this._crypto) {
            throw new Error('No MatrixFiles connected');
        }
        return this._crypto;
    }

    public get hasAuthData(): boolean {
        return !!this.homeserverUrl && !!this.accessToken && !!this.deviceId && !!this.userId;
    }

    public async rehydrate() {
        this._files = await createFromToken(localStorage, this.homeserverUrl, this.accessToken, this.userId, this.deviceId);
        await this.bootstrap();
    }

    private storeValues() {
        storeValue("homeserverUrl", this.homeserverUrl);
        storeValue("accessToken", this.accessToken);
        storeValue("deviceId", this.deviceId);
        storeValue("userId", this.userId);
    }

    public async login() {
        this._files = await loginWithPassword(localStorage, this.homeserverUrl, this.userId, this.password);

        this.homeserverUrl = this.client.getHomeserverUrl();
        this.accessToken = this.client.getAccessToken();
        this.deviceId = this.client.deviceId ?? '';
        this.userId = this.client.getUserId();

        this.storeValues();

        await this.bootstrap();
    }

    public async register() {
        this._files = await registerWithPassword(localStorage, this.homeserverUrl, this.userId, this.password);

        this.homeserverUrl = this.client.getHomeserverUrl();
        this.accessToken = this.client.getAccessToken();
        this.deviceId = this.client.deviceId ?? '';
        this.userId = this.client.getUserId();

        this.storeValues();

        await this.bootstrap();
    }

    private async bootstrap() {
        if (!this._files) {
            throw new Error('Not logged in');
        }
        this.client.on("Session.logged_out", () => {
            console.log("Session.logged_out");
            this._logout();
        });
        this._crypto = new MatrixCrypto(this._files.client);
        await this._crypto.init();
        await this._files.sync();
        this.authedState.update(true);
    }

    private _logout() {
        this.homeserverUrl = defaultHomeserver;
        this.userId = '';
        this.keyBackupPassphrase = '';
        this.password = '';
        this.deviceId = '';
        this.accessToken = '';
        this.storeValues();
        this.authedState.update(false);
    }

    public async logout() {
        if (this._files) {
            await this._files.logout();
            this._files = undefined;
            this._crypto = undefined;
            localStorage.clear();
        }
        this._logout();
    }

    on(event: string, handler: (...args: any[]) => void) {
        if (this._files) {
            this._files.on(event, handler);
        }        
    }

    off(event: string, handler: (...args: any[]) => void) {
        if (this._files) {
            this._files.off(event, handler);
        }        
    }
}
