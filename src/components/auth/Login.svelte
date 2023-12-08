<!--
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
-->

<svelte:head>
    <title>Sign in</title>
</svelte:head>

<script lang="ts">
    import router from 'page';
    import type { ClientManager } from "../../ClientManager";
    import Textfield from "@smui/textfield";
    import HelperText from "@smui/textfield/helper-text";
    import Button, { Label } from "@smui/button";
    import { Title } from "@smui/paper";
    import CircularProgress from '@smui/circular-progress';
    import { getLoginFlows, getWellKnown } from '../../auth';
    import { onDestroy, onMount } from 'svelte';
    import { getLogger } from 'log4js';
    import Card from "@smui/card";
    import QrCode from "svelte-qrcode";
    import { debounce } from '../../utils';
    import type { DeviceAuthorizationResponse } from 'oidc-client-ts';
    import ScanQRCode from "./ScanQRCode.svelte";
    import { decodeBase64 } from 'matrix-js-sdk/lib/crypto/olmlib';
    import { type ECDHv2RendezvousCode, MSC3903ECDHv2RendezvousChannel, type MSC3903ECDHPayload } from "matrix-js-sdk/src/rendezvous/channels";
    import { MSC3886SimpleHttpRendezvousTransport, type MSC3886SimpleHttpRendezvousTransportDetails } from "matrix-js-sdk/src/rendezvous/transports";
    import { PayloadType, type MSC3906RendezvousPayload, Outcome, RendezvousFailureReason } from 'matrix-js-sdk/src/rendezvous';

    export let clientManager: ClientManager;

    const log = getLogger('Login');

    let errorMessage = '';
    let loading = false;

    let passwordSupported = false;
    let oidcSupported = false;
    let deviceFlowSupported = false;
    let scanQrCode = false;
    let scanQrResult = "";
    let scanQrChecksum: string[] = [];
    let oidcDeviceFlow: DeviceAuthorizationResponse | undefined;
    let rzChannel: MSC3903ECDHv2RendezvousChannel<MSC3906RendezvousPayload> | undefined;

    let homeserverInput = clientManager.homeserverUrl;
    
    let loadedServerInfo = '';

    $: params = new URLSearchParams(document.location.search);
    let dagPrettyUri = '';


    async function oidcDiscovery() {
        clientManager.oidcIssuer = '';
        try {
            const wellKnown = await getWellKnown(clientManager.homeserverUrl);
            if (wellKnown['m.homeserver']?.base_url && wellKnown['m.homeserver'].base_url !== clientManager.homeserverUrl) {
                clientManager.homeserverUrl = wellKnown['m.homeserver'].base_url;
            }
            clientManager.oidcIssuer = wellKnown['org.matrix.msc2965.authentication']?.issuer ?? '';
        } catch (e: any) {
            // OIDC is not supported as no .well-known
            log.warn(e);
        }
    }
    $: (async () => {
        if (params.has('error_description')) {
            errorMessage = params.get('error_description') ?? params.get('error') ?? '';
            window.history.pushState('object', document.title, location.href.split("?")[0]);
            params = new URLSearchParams(document.location.search);
            loadedServerInfo = clientManager.homeserverUrl;
        }
        if (params.has('code')) {
            // OIDC in progress?
        } else if (!scanQrCode && loadedServerInfo !== clientManager.homeserverUrl) {
            try {
                errorMessage = '';
                passwordSupported = false;
                deviceFlowSupported = false;                
                await oidcDiscovery();
                oidcSupported = !!clientManager.oidcIssuer;

                passwordSupported = (await getLoginFlows(clientManager.homeserverUrl)).flows.some(x => x.type === 'm.login.password');

                if (oidcSupported) {
                    try {
                        await clientManager.assertOidcClientId();
                        deviceFlowSupported = await clientManager.supportsDeviceCode();
                    } catch (e: any) {
                        log.warn(e);
                        oidcSupported = false;
                        if (!passwordSupported) {
                            throw new Error(`Homeserver is not compatible with this Matrix client: ${e?.message ?? 'An error occurred'}`);
                        }
                    }
                }
            } catch (e: any) {
                errorMessage = e?.message ?? 'An error occurred';
            }
            loadedServerInfo = clientManager.homeserverUrl;
        }
    })();

    async function loginWithPassword() {
        log.info('loginWithPassword()');
        try {
            errorMessage = '';
            loading = true;
            await clientManager.loginWithPassword();
            router.replace('/');
        } catch (e: any) {
            log.error(e);
            errorMessage = [e.errcode, e.cause?.message ?? e.message].filter(x => !!x).join(': ');
        } finally {
            loading = false;
        }
    }

    async function loginWithOidc(deviceFlow: boolean) {
        log.info('loginWithOidc()');
        errorMessage = '';
        try {
            if (deviceFlow) {
                oidcDeviceFlow = await clientManager.startLoginWithOidcDeviceFlow();
                await clientManager.waitForLoginWithOidcDeviceFlow();
                oidcDeviceFlow = undefined;
            } else {
                await clientManager.loginWithOidcNormalFlow();
            }
        } catch (e: any) {
            log.warn(e);
            errorMessage = `Unable to sign in: ${e.error_description ?? e.error ?? e.message ?? 'An error occurred'}`;
        }
    }
    
    const debouncedHomeserver = debounce(() => clientManager.homeserverUrl = homeserverInput, 250);

    function startQRScan() {
        errorMessage = '';
        scanQrResult = '';
        scanQrChecksum = [];
        scanQrCode = true;
        dagPrettyUri = '';
        oidcDeviceFlow = undefined;
    }

    function onRendezvousFailure() {
        errorMessage = 'Rendezvous failed';
    }

    /**
     * 
     * {"rendezvous":{
     * "algorithm":"org.matrix.msc3903.rendezvous.v2.curve25519-aes-sha256",
     * "key":"VC7riVue45UUWUZaFYybC9TtnwB8H+Potv5kayAnRyQ",
     * "transport":{"type":"org.matrix.msc3886.http.v1","uri":"https://rendezvous.lab.element.dev/9aec8d8e-9937-46a1-bfce-c06314b037c7"}
     * },
     * "intent":"login.reciprocate"}
     */
    async function onQRScanResult() {
        errorMessage = '';
        console.log(scanQrResult);
        try {
            const json = JSON.parse(scanQrResult);
            if (
                typeof json !== 'object' ||
                typeof json.intent !== 'string' ||
                typeof json.rendezvous !== 'object' ||
                typeof json.rendezvous.algorithm !== 'string' ||
                typeof json.rendezvous.transport !== 'object' ||
                typeof json.rendezvous.transport.type !== 'string'
            ) {
                throw new Error('Invalid QR code');
            }
            if (json.intent !== 'login.reciprocate') {
                throw new Error('The other device must be signed in');
            }
            if (json.rendezvous.algorithm !== 'org.matrix.msc3903.rendezvous.v2.curve25519-aes-sha256') {
                throw new Error('Unsupported rendezvous algorithm');
            }
            if (json.rendezvous.transport.type !== 'org.matrix.msc3886.http.v1') {
                throw new Error('Unsupported transport type');
            }
            if (typeof json.rendezvous.transport.uri !== 'string') {
                throw new Error('Transport URI is missing');
            }
            if (typeof json.rendezvous.key !== 'string') {
                throw new Error('Rendezvous key is missing');
            }
            try {
                new URL(json.rendezvous.transport.uri);
            } catch (e: any) {
                throw new Error(`Invalid transport URI: ${e.message}`);
            }
            const code = JSON.parse(scanQrResult) as ECDHv2RendezvousCode;
            const transport = new MSC3886SimpleHttpRendezvousTransport({ details: code.rendezvous.transport as MSC3886SimpleHttpRendezvousTransportDetails });

            rzChannel = new MSC3903ECDHv2RendezvousChannel<MSC3906RendezvousPayload>(
                transport,
                decodeBase64(code.rendezvous.key),
                onRendezvousFailure,
            );
            scanQrChecksum = await rzChannel.connect();
            const protocols = await rzChannel.receive();

            if (!protocols?.protocols || !Array.isArray(protocols.protocols) || !protocols.homeserver) {
                throw new Error('Received invalid protocols from other device');
            }

            if (!protocols.protocols.includes('org.matrix.msc3906.device_authorization_grant')) {
                throw new Error('No supported login protocol');
            }

            homeserverInput = protocols.homeserver;
            // check if we can connect to the homeserver
            clientManager.homeserverUrl = protocols.homeserver;
            await oidcDiscovery ();

            if (!clientManager.oidcIssuer) {
                throw new Error('Homeserver does not support OIDC');
            }

            oidcDeviceFlow = await clientManager.startLoginWithOidcDeviceFlow();
            const { verification_uri, verification_uri_complete, user_code} = oidcDeviceFlow;

            const url = new URL(verification_uri ?? verification_uri_complete ?? '');
            dagPrettyUri = url.host + url.pathname;

            await rzChannel.send({ type: PayloadType.Progress, protocol: "org.matrix.msc3906.device_authorization_grant", device_authorization_grant: {
                verification_uri, verification_uri_complete, user_code,
            } });

            await clientManager.waitForLoginWithOidcDeviceFlow();

            await rzChannel.send({ type: PayloadType.Finish, outcome: Outcome.Success, device_id: clientManager.deviceId, device_key: clientManager.client.getDeviceEd25519Key() });
            const next = await rzChannel.receive();
            console.log(next);
        } catch (e: any) {
            errorMessage = e.message;
            await rzChannel?.close();
            return;
        }
        // await aliceRz.generateCode();
        // const code = JSON.parse(aliceRz.code!) as ECDHRendezvousCode;

        // expect(code.rendezvous.key).toBeDefined();

        // const aliceStartProm = aliceRz.startAfterShowingCode();

        // // bob is try to sign in and scans the code
        // const bobOnFailure = jest.fn();
        // const bobEcdh = new MSC3903ECDHRendezvousChannel(
        //     bobTransport,
        //     decodeBase64(code.rendezvous.key), // alice's public key
        //     bobOnFailure,
        // );

        // const bobStartPromise = (async () => {
        //     const bobChecksum = await bobEcdh.connect();
        //     logger.info(`Bob checksums is ${bobChecksum} now sending intent`);
        //     // await bobEcdh.send({ type: 'm.login.progress', intent: RendezvousIntent.LOGIN_ON_NEW_DEVICE });

        //     // wait for protocols
        //     logger.info("Bob waiting for protocols");
        //     const protocols = await bobEcdh.receive();

        //     logger.info(`Bob protocols: ${JSON.stringify(protocols)}`);

        //     expect(protocols).toEqual({
        //         type: "m.login.progress",
        //         protocols: ["org.matrix.msc3906.login_token"],
        //     });

        //     await bobEcdh.send({ type: "m.login.progress", protocol: "org.matrix.msc3906.login_token" });
        // })();

        // await aliceStartProm;
        // await bobStartPromise;

        // const confirmProm = aliceRz.approveLoginOnExistingDevice("token");

        // const bobLoginProm = (async () => {
        //     const loginToken = await bobEcdh.receive();
        //     expect(loginToken).toEqual({ type: "m.login.progress", login_token: "token", homeserver: alice.baseUrl });
        //     await bobEcdh.send({ type: "m.login.finish", outcome: "success", device_id: "BOB", device_key: "bbbb" });
        // })();

        // expect(await confirmProm).toEqual("BOB");
        // await bobLoginProm;
    }

    async function dontMatch() {
        await rzChannel?.cancel(RendezvousFailureReason.DataMismatch);
        rzChannel = undefined;
        scanQrCode = false;
    }

    onMount(async () => {
        log.debug('onMount()');
		if (params.has('error')) {
            log.warn(`Received OIDC error: ${params.get('error_description') ?? params.get('error')}`)
            errorMessage =(params.get('error_description') ?? params.get('error')) ?? 'An error occurred';
        } else if (params.has('code')) {
            await clientManager.completeOidcLogin();
        } else if (params.has('state')) {

        }
    });

    onDestroy(() => log.debug('onDestroy()'));
</script>

<div>
    <Title style="font-size: 24px; font-weight: 600; ">Sign in</Title>
    <p>
        <strong>Please use a dedicated test account. The homeserver also needs to allow high request rates.</strong>
    </p>

    <form on:submit|preventDefault={() => {}}>
        {#if scanQrCode}
            <Card padded style="max-width: 500px">
                {#if errorMessage}
                    <p style="color: red; text-align: center; font-weight: bold;">
                        {errorMessage}
                    </p>
                {/if}
                {#if scanQrResult}
                    <p style="text-align: center;">
                        Check that the emojis below match those shown on your other device:
                    </p>
                    <p style="text-align: center; font-weight: bold; font-size: 2em">
                        {scanQrChecksum.join(' ')}
                    </p>
                    {#if dagPrettyUri}
                        <p style="text-align: center;">
                            Once confirmed, your other device will open <strong>{dagPrettyUri}</strong> to complete sign in. Confirm or enter code <strong>{oidcDeviceFlow?.user_code}</strong> as needed.
                        </p>
                    {/if}
                    {#if errorMessage}
                        <Button variant="unelevated" on:click={() => scanQrResult = ""}>
                            Try again
                        </Button>
                    {/if}
                    <Button on:click={() => dontMatch()}>
                        They don't match
                    </Button>

                {:else}
                    <ScanQRCode enableQRCodeReaderButton={false} bind:scanResult={scanQrResult} options={{
                        onResulted: onQRScanResult,
                        onPermissionError: () => errorMessage = 'Camera permission denied',
                    }} />
                    <Button on:click={() => scanQrCode = false}>
                        Cancel
                    </Button>
                {/if}
            </Card>
        {:else}
            <Card padded style="max-width: 500px">
                <Textfield variant="outlined" label="Homeserver" type="text" bind:value={homeserverInput} on:keyup={debouncedHomeserver} required style="margin-top: 16px;">
                    <HelperText slot="helper">e.g. https://matrix.org</HelperText>
                </Textfield>
                {#if errorMessage}
                    <p style="color: red; text-align: center; font-weight: bold;">
                        {errorMessage}
                    </p>
                {/if}
                <Button variant="unelevated" on:click={startQRScan}>
                    Scan QR code
                </Button>
                {#if oidcDeviceFlow}
                    <div style="text-align: center">
                        {#if oidcDeviceFlow.verification_uri_complete}
                            <p>Scan this code on your other device to continue sign in</p>
                            <div>
                                <QrCode value={oidcDeviceFlow.verification_uri_complete} />                        
                            </div>
                        {/if}
                        <p>{oidcDeviceFlow.verification_uri_complete ? 'or go' : 'Go'} to:</p>
                        <p><strong>{oidcDeviceFlow.verification_uri}</strong></p>
                        <p>and enter code:</p>
                        <p><strong>{oidcDeviceFlow.user_code}</strong></p>

                        <p>Changed your mind?</p>
                        <Button variant="unelevated" disabled={loading} on:click={() => loginWithOidc(false)}>
                            Continue on this device
                            {#if loading}
                                <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                            {/if}                  
                        </Button>
        
                    </div>
                {:else if oidcSupported}
                    <p>
                        Homeserver { clientManager.homeserverUrl } supports auth via OIDC:
                    </p>
                    {#if deviceFlowSupported }
                        <p>
                            Already signed in on another device? You can use it to complete sign in
                        </p>
                        <Button variant="unelevated" disabled={loading} on:click={() => loginWithOidc(true)}>
                            Use another device
                            {#if loading}
                                <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                            {/if}                  
                        </Button>
                        <p style="text-align: center">or:</p>
                    {/if}
                    <Button variant="unelevated" disabled={loading} on:click={() => loginWithOidc(false)}>
                        {deviceFlowSupported ? 'Continue on this device' : 'Continue'}
                        {#if loading}
                            <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                        {/if}                  
                    </Button>
                {:else if passwordSupported}
                    <p>
                        Homeserver { clientManager.homeserverUrl } supports auth via Matrix password:
                    </p>
                    <Textfield variant="outlined" label="Username" type="text" bind:value={clientManager.userId} required style="margin-top: 16px;">
                        <HelperText slot="helper">Your matrix username</HelperText>
                    </Textfield>
                    <Textfield variant="outlined" label="Password" type="password" bind:value={clientManager.password} required style="margin-top: 16px;">
                        <HelperText slot="helper">Your matrix password</HelperText>
                    </Textfield>
                    <Button type="submit" variant="unelevated" disabled={loading} on:click={() => loginWithPassword()}>
                        Sign in with HS password
                        {#if loading}
                            <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                        {/if}
                    </Button>        
                {/if}
                <p>
                    Not got an account?
                    <Button on:click:preventDefault={() => router.show('/register')} href="#">
                        <Label>Register</Label>
                    </Button>
                </p>
            </Card>
        {/if}
        <p>
            <i>It is recommended to use a dedicated test account as the E2E encryption settings used in this beta version may clash with your existing account and your keys get lost.</i>
        </p>
    </form>    
</div>
