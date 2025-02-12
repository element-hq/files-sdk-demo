<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<svelte:head>
    <title>Settings</title>
</svelte:head>

<script lang="ts">
    import { JsonView } from '@zerodevx/svelte-json-view'
    import type { ClientManager } from "../ClientManager";
    import { onMount } from "svelte";
    import type { IMyDevice } from "matrix-js-sdk/lib";
    import dayjs from "dayjs";
    import type { DeviceTrustLevel } from "matrix-js-sdk/lib/crypto/CrossSigning";
    import { Icon } from "@smui/button";
    import type { IKeyBackupInfo } from 'matrix-js-sdk/lib/crypto/keybackup';
    import { getWellKnown } from '../auth';

    export let clientManager: ClientManager;
    
    function client() {
        return clientManager.client;
    }

    let isCrossSigningReady: boolean | undefined;
    let isSecretStorageReady: boolean | undefined;
    let isKeyBackupAvailable: boolean | undefined;
    let keyBackupInfo: IKeyBackupInfo | undefined;
    let devices: IMyDevice[] = [];
    let deviceTrust: Record<string, DeviceTrustLevel> = {};
    let manageAccountLink: string | undefined;

    async function update() {
        isCrossSigningReady = await client().isCrossSigningReady();
        isSecretStorageReady = await client().isSecretStorageReady();
        isKeyBackupAvailable = await clientManager.crypto.isKeyBackupAvailable();
        keyBackupInfo = await clientManager.crypto.getKeyBackupInfo() ?? undefined;
        devices = (await client().getDevices()).devices;
        const userId = clientManager.client.getUserId();
        if (userId) {
            deviceTrust = devices.reduce((map, d) => {
                map[d.device_id] = clientManager.client.checkDeviceTrust(userId, d.device_id);
                return map;
            }, {} as Record<string, DeviceTrustLevel>);
        }
        manageAccountLink = (await getWellKnown(client().baseUrl))['org.matrix.msc2965.authentication']?.account;       
    }
    onMount(update);
</script>

<h3>General</h3>
<p>Homeserver: {client().getHomeserverUrl()}</p>
<p>User ID: {client().getUserId()}</p>
<p>Device ID: {client().getDeviceId()}</p>
<p>MatrixClient.isCrossSigningReady: {isCrossSigningReady === undefined ? 'checking' : isCrossSigningReady}</p>
<p>MatrixClient.isSecretStorageReady: {isSecretStorageReady === undefined ? 'checking' : isSecretStorageReady}</p>

{#if manageAccountLink }
    <p>
        <a href="{manageAccountLink}" target="_blank">Manage account</a>
    </p>
{/if}
<hr>
<h3>Sessions</h3>
<ul>
    {#each devices as d}
        <li title={d.device_id}><Icon class="material-icons-round" style={deviceTrust[d.device_id].crossSigningVerified || client().getDeviceId() === d.device_id ? 'color: var(--mdc-theme-primary)' : 'color: var(--mdc-theme-error)'}>{deviceTrust[d.device_id].crossSigningVerified || client().getDeviceId() === d.device_id  ? 'gpp_good' : 'gpp_maybe'}</Icon>{d.display_name || d.device_id} from {d.last_seen_ip ?? 'unknown'} at {d.last_seen_ts ? dayjs(d.last_seen_ts).format('LT') : 'unknown'}{client().getDeviceId() === d.device_id ? ' this session' : ''}</li>        
    {/each}
</ul>

<hr>
<h3>Key backup</h3>
<p>MatrixCrypto.isKeyBackupAvailable: {isKeyBackupAvailable === undefined ? 'checking' : isKeyBackupAvailable}</p>
<p>MatrixCrypto.isConnectedToKeyBackup: {clientManager.crypto.isConnectedToKeyBackup()}</p>
<p>MatrixCrypto.getKeyBackupInfo():<br>
    <JsonView json={keyBackupInfo} />
</p>

<style>
</style>
