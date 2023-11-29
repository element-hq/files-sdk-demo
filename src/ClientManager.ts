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
import { HttpApiError, MatrixError } from "matrix-js-sdk/lib";
import { toasts } from "svelte-toasts";
import router from 'page';
import { getLogger } from "log4js";
import {
    UserManager, MetadataService, OidcClientSettingsStore, type ExtraSigninRequestArgs,
} from 'oidc-client-ts';

const log = getLogger('ClientManager');

const defaultHomeserver = process.env.DEFAULT_HOMESERVER!;

export class ClientManager {
    private _files: MatrixFiles | undefined;
    private _crypto: MatrixCrypto | undefined;

    public readonly authedState = new SimpleObservable<boolean>(false);

    public get homeserverUrl(): string {
        return readValue("homeserverUrl", defaultHomeserver);
    }

    public set homeserverUrl(val) {
        storeValue("homeserverUrl", val);
    }

    public get oidcIssuer(): string {
        return readValue("oidcIssuer", '');
    }

    public set oidcIssuer(val) {
        storeValue("oidcIssuer", val);
    }

    public get oidcClientIssuer(): string {
        return readValue("oidcClientIssuer", '');
    }

    public set oidcClientIssuer(val) {
        storeValue("oidcClientIssuer", val);
    }

    public get oidcClientId(): string {
        return readValue("oidcClientId", '');
    }

    public set oidcClientId(val) {
        storeValue("oidcClientId", val);
    }

    public get oidcClientSecret(): string {
        return readValue("oidcClientSecret", '');
    }

    public set oidcClientSecret(val) {
        storeValue("oidcClientSecret", val);
    }

    public get accessToken(): string {
        return readValue("accessToken", '');
    }

    public set accessToken(val) {
        storeValue("accessToken", val);
    }

    public get deviceId(): string {
        return readValue("deviceId", '');
    }

    public set deviceId(val) {
        storeValue("deviceId", val);
    }

    public get userId(): string {
        return readValue("userId", '');
    }

    public set userId(val) {
        storeValue("userId", val);
    }

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

    private userManager: UserManager | undefined;

    private async getOidcUserManager() {
        if (this.userManager && this.userManager.settings.authority !== this.oidcIssuer) {
            log.info('Recreating OIDC UserManager as issuer changed');
            this.userManager.stopSilentRenew();
            this.userManager = undefined;
        }

        if (!this.userManager) {
            const authority = this.oidcIssuer;
            const client_uri = document.location.origin + document.location.pathname;
            const redirect_uri = client_uri;

            if (!this.oidcClientId || this.oidcClientIssuer !== authority) {
                const { registration_endpoint } = await (new MetadataService(new OidcClientSettingsStore({
                    authority,
                    redirect_uri,
                    client_id: 'notused',
                }))).getMetadata();

                if (!registration_endpoint) {
                    throw new Error('Server does not support client registration');
                }

                const clientMetadata = {
                    client_name: "Files SDK Demo",
                    logo_uri: new URL("logo.svg", client_uri).href,
                    client_uri,
                    tos_uri: "https://element.io/terms-of-service",
                    policy_uri: "https://element.io/privacy",
                    response_types: ["code"],
                    grant_types: ["authorization_code", "refresh_token"],
                    redirect_uris: [redirect_uri],
                    id_token_signed_response_alg: "RS256",
                    token_endpoint_auth_method: "none",
                };

                const res = await fetch(registration_endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: "omit",
                    cache: 'no-cache',
                    body: JSON.stringify(clientMetadata),
                });

                const json = await res.json();

                this.oidcClientId = json.client_id;
                this.oidcClientSecret = json.client_secret;
                this.oidcClientIssuer = authority;

                log.info(`Registered with OIDC issuer as ${this.oidcClientId}`);
            }

            this.userManager = new UserManager({
                authority,
                client_id: this.oidcClientId,
                client_secret: this.oidcClientSecret,
                redirect_uri,
                accessTokenExpiringNotificationTimeInSeconds: 30,
            });
            this.userManager.events.addUserLoaded(({ access_token, expires_in }) => {
                log.debug(`Access token renewed with new expiry in ${expires_in}s`);
                this.accessToken = access_token;
                if (this._files) {
                    this._files.client.http.opts.accessToken = access_token;
                }
            });
        }

        return this.userManager;
    }

    public get hasAuthData(): boolean {
        log.debug(`hasAuthData() homeserverUrl=${!!this.homeserverUrl} accessToken=${!!this.accessToken} deviceId=${!!this.deviceId} userId=${!!this.userId}`);
        return !!this.homeserverUrl && !!this.accessToken && !!this.deviceId && !!this.userId;
    }

    private async wrapForbidden(f: () => Promise<any>) {
        try {
            await f();
        } catch (e: any) {
            console.error(e.errcode);
            if (e instanceof MatrixError && e.errcode === 'M_FORBIDDEN') {
                toasts.warning('You have been signed out', { duration: 5000 });
                await this._logout(this.homeserverUrl);
                router.redirect('/signin');
            } else {
                throw e;
            }
        }

    }

    public async rehydrate() {
        if (this.oidcIssuer) {
            // initialise UserManager for refreshing tokens
            this.getOidcUserManager();
        }
        await this.wrapForbidden(async () => {
            this._files = await createFromToken(localStorage, this.homeserverUrl, this.accessToken, this.userId, this.deviceId);
            await this.bootstrap();
        });
    }

    public async loginWithOidc() {
        log.info('loginWithOidc()');
        await (await this.getOidcUserManager()).signinRedirect({ prompt: 'login' } as any as ExtraSigninRequestArgs);
    }

    public async registerWithOidc() {
        log.info('registerWithOidc()');
        await (await this.getOidcUserManager()).signinRedirect({ prompt: 'create' } as any as ExtraSigninRequestArgs);
    }

    public async completeOidcLogin() {
        log.info('completeLoginWithAccessToken()');

        const authority = this.oidcIssuer;
        if (!authority) {
            log.warn('Received OIDC code but no issuer available');
        } else {
            const signinResponse = await (await this.getOidcUserManager()).signinCallback();
            if (signinResponse) {
                const { access_token } = signinResponse;

                const url = new URL(this.homeserverUrl);
                url.search = '';
                url.pathname = '/_matrix/client/v3/account/whoami';

                const response = await fetch(url.href, { headers: { Authorization: `Bearer ${access_token}` } });

                const { device_id, user_id } = await response.json();

                this.accessToken = access_token;
                this.deviceId = device_id;
                this.userId = user_id;
                this.password = '';

                // remove query params from current URL:
                window.history.pushState('object', document.title, location.href.split("?")[0]);

                await this.rehydrate();

                router.replace('/');

            }
        }
    }

    public async loginWithPassword() {
        log.info('loginWithPassword()');
        this._files = await loginWithPassword(localStorage, this.homeserverUrl, this.userId, this.password);

        this.homeserverUrl = this.client.getHomeserverUrl();
        this.accessToken = this.client.getAccessToken() ?? '';
        this.deviceId = this.client.deviceId ?? '';
        this.userId = this.client.getUserId() ?? '';

        await this.wrapForbidden(this.bootstrap);
    }

    public async register() {
        log.info('register()');
        this._files = await registerWithPassword(localStorage, this.homeserverUrl, this.userId, this.password);

        this.homeserverUrl = this.client.getHomeserverUrl();
        this.accessToken = this.client.getAccessToken() ?? '';
        this.deviceId = this.client.deviceId ?? '';
        this.userId = this.client.getUserId() ?? '';

        await this.wrapForbidden(this.bootstrap);
    }

    private async bootstrap() {
        if (!this._files) {
            throw new Error('Not logged in');
        }
        this.client.on(HttpApiEvent.SessionLoggedOut, () => {
            console.log("Session.logged_out");
            this._logout(this.homeserverUrl);
        });
        // ping to check that session is valid
        await this.client.whoami();
        this._crypto = new MatrixCrypto(this._files.client);
        await this._crypto.init();
        await this._files.sync();
        toasts.info(`${this.userId} logged in`, { duration: 5000 });
        this.authedState.update(true);
    }

    private async _logout(homeserver?: string) {
        // try {
        //     await logoutOidc();
        // } catch (e) {
        //     // it might be that it isn't intialised
        // }
        this.homeserverUrl = homeserver ?? defaultHomeserver;
        this.userId = '';
        this.keyBackupPassphrase = '';
        this.password = '';
        this.deviceId = '';
        this.accessToken = '';
        this.authedState.update(false);
    }

    public async logout() {
        log.info('logout()');
        if (this._files) {
            try {
                await this._files.logout();
            } catch (e) {
                log.warn(e);
            }
            this._files = undefined;
            this._crypto = undefined;
        }
        localStorage.clear();
        sessionStorage.clear();
        await this._logout();
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
