<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<svelte:head>
    <title>Register</title>
</svelte:head>

<script lang="ts">
    import router from 'page';
    import type { ClientManager } from "../../ClientManager";
    import Textfield from "@smui/textfield";
    import HelperText from "@smui/textfield/helper-text";
    import Button, { Label } from "@smui/button";
    import { Title } from "@smui/paper";
    import CircularProgress from '@smui/circular-progress';
    import { getLogger } from 'log4js';
    import { onMount } from 'svelte';
    import { getLoginFlows, getWellKnown } from '../../auth';
    import Card from "@smui/card";
    import { debounce } from '../../utils';

    export let clientManager: ClientManager;

    const log = getLogger('Register');

    let errorMessage = '';
    let loading = false;

    let passwordSupported = false;
    let oidcSupported = false;

    let homeserverInput = clientManager.homeserverUrl;
    
    let loadedServerInfo = '';

    $: params = new URLSearchParams(document.location.search);

    $: (async () => {
        if (params.has('code')) {
            // OIDC in progress?
        } else if (loadedServerInfo !== clientManager.homeserverUrl) {
            try {
                errorMessage = '';
                passwordSupported = false;
                oidcSupported = false;
                clientManager.oidcIssuer = '';
                try {
                    const wellKnown = await getWellKnown(clientManager.homeserverUrl);
                    if (wellKnown['m.homeserver']?.base_url && wellKnown['m.homeserver'].base_url !== clientManager.homeserverUrl) {
                        clientManager.homeserverUrl = wellKnown['m.homeserver'].base_url;
                    }
                    clientManager.oidcIssuer = wellKnown['org.matrix.msc2965.authentication']?.issuer ?? '';
                    oidcSupported = !!clientManager.oidcIssuer;
                } catch (e: any) {
                    // OIDC is not supported as no .well-known
                    log.warn(e);
                }
                passwordSupported = (await getLoginFlows(clientManager.homeserverUrl)).flows.some(x => x.type === 'm.login.password');
            } catch (e: any) {
                errorMessage = e?.message ?? 'An error occured';
            }
            loadedServerInfo = clientManager.homeserverUrl;
        }
    })();

    async function registerWithPassword() {
        log.info('registerWithPassword()');
        try {
            errorMessage = '';
            loading = true;
            await clientManager.register();
            router.replace('/');
        } catch (e: any) {
            console.error(e);
            errorMessage = [e.errcode, e.cause?.message ?? e.message].filter(x => !!x).join(': ');
        } finally {
            loading = false;
        }
    }

    async function registerWithOidc() {
        log.info('registerWithOidc()');
        await clientManager.registerWithOidc();
    }

    const debouncedHomeserver = debounce(() => clientManager.homeserverUrl = homeserverInput, 250);

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
</script>

<div>
    <Title style="font-size: 24px; font-weight: 600; ">Create account</Title>
    <p>
        <strong>The homeserver needs to allow high request rates.</strong>
    </p>

    <form on:submit|preventDefault={() => {}}>
        <Card padded style="max-width: 500px">
            <Textfield variant="outlined" label="Homeserver" type="text" bind:value={homeserverInput} on:keyup={debouncedHomeserver} required style="margin-top: 16px;">
                <HelperText slot="helper">e.g. https://matrix.org</HelperText>
            </Textfield>
            {#if errorMessage}
                <p style="color: red; text-align: center; font-weight: bold;">
                    {errorMessage}
                </p>
            {/if}
            {#if oidcSupported}
                <p>
                    Homeserver { clientManager.homeserverUrl } supports auth via OIDC:
                </p>
                <Button variant="unelevated" disabled={loading} on:click={() => registerWithOidc()}>
                    Continue
                    {#if loading}
                        <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                    {/if}                  
                </Button>
            {:else if passwordSupported}
                <p>
                    Homeserver { clientManager.homeserverUrl } supports auth via Matrix password:
                </p>
                <Textfield variant="outlined" label="Username" type="text" bind:value={clientManager.userId} required style="margin-top: 16px;">
                    <HelperText slot="helper"></HelperText>
                </Textfield>
                <Textfield variant="outlined" label="Password" type="password" bind:value={clientManager.password} required style="margin-top: 16px;">
                    <HelperText slot="helper"></HelperText>
                </Textfield>
                <Button type="submit" variant="unelevated" disabled={loading} on:click={() => registerWithPassword()}>
                    Register with HS password
                    {#if loading}
                        <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                    {/if}
                </Button>
            {/if}
            <p>
                Already have an account?
                <Button on:click:preventDefault={() => router.show('/signin')} href="#">
                    <Label>Sign in</Label>
                </Button>
            </p>
        </Card>
    </form>    
</div>
