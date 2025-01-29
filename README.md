# Demo web client for Matrix Files SDK

This web client was developed to showcase the capabilities of [matrix-files-sdk](https://github.com/matrix-org/matrix-files-sdk).

Features include:

- Upload single and multiple files
- Basic file operations: rename, delete, download
- Preview some common file formats: images, text, markdown, PDF
- Inline editing of markdown using [ByteMD](https://github.com/bytedance/bytemd)
- Folder sharing and permission management
- View version history for files
- End-to-end encryption
- Encryption key backup using a passphrase

## Live demo

[Try it for yourself](https://vector-im.github.io/files-sdk-demo/)

## Development

Install the dependencies...

```bash
yarn install
```

...then start to run a local web server to help with development:

```bash
yarn dev
```

Navigate to [localhost:5001](http://localhost:5001). You should see the app running. Edit a component file in `src`, save it, and reload the page to see your changes.

If you're using [Visual Studio Code](https://code.visualstudio.com/) we recommend installing the official extension [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

If you are using other editors you may need to install a plugin in order to get syntax highlighting and intellisense.

## Building and running in production mode

To create an optimised version of the app which defaults to matrix.org homeserver:

```bash
DEFAULT_HOMESERVER=https://matrix.org yarn build
```

This will output a set of files into the `dist` folder which can then be deployed to a CDN or web server (example [here](.github/workflows/ci.yml)).

## Copyright & License

Copyright (c) 2020 The Matrix.org Foundation C.I.C.

Copyright (c) 2021-2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.
