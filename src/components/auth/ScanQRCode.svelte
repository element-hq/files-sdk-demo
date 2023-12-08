<script lang="ts">
  import { onMount } from "svelte";
  import jsQR from "jsqr";

  type optionsType = {
    onPermissionError?: Function;
    onResulted?: Function;
  };

  export let scanResult: string = "";
  export let enableQRCodeReaderButton: boolean;
  export let options: optionsType;

  let video: HTMLVideoElement | undefined;
  let canvas: HTMLCanvasElement | undefined;

  onMount(() => {
    requestCamera();
  });

  function requestCamera() {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
        },
      })
      .then((userStream) => {
        video.srcObject = userStream;
        video.setAttribute("playsinline", true);
        video.play();
        startScan();
      })
      .catch((err) => {
        if (options?.onPermissionError != undefined) {
          options.onPermissionError();
        } else {
          alert(err);
        }
      });
  }

  function startScan() {
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;

    context.drawImage(video, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const qrCode = jsQR(imageData.data, width, height);

    if (qrCode) {
      scanResult = qrCode.data;
      if (options?.onResulted != undefined) {
        options.onResulted(qrCode.data);
      } else {
        alert(qrCode.data);
        setTimeout(startScan, 1000);
      }
    } else {
      setTimeout(startScan, 500);
    }
  }

  function onCanPlay() {
    if (!canvas) {
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    startScan();
  }

  function qrcodeReader(e: any) {
    try {
      let file = e.target.files[0];
      let reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e: any) => {
        let img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const context = canvas.getContext("2d");
          context.imageSmoothingEnabled = false;
          context.drawImage(img, 0, 0);
          const imageData = context.getImageData(0, 0, img.width, img.height);
          const qrCode = jsQR(imageData.data, img.width, img.height);
          if (qrCode) {
            scanResult = qrCode.data;
            if (options?.onResulted != undefined) {
              options.onResulted(qrCode.data);
            } else {
              alert(qrCode.data);
            }
          }
        };
      };
    } catch (error) {
      console.error(error);
    }
  }
</script>

<canvas bind:this={canvas} />
<!-- svelte-ignore a11y-media-has-caption -->
<video on:canplay={onCanPlay} bind:this={video} />

{#if enableQRCodeReaderButton}
  <input
    class="image-qrcode-input"
    type="file"
    id="upload-qrcode-image"
    accept=".jpg, .jpeg, .png"
    on:change={(e) => qrcodeReader(e)}
  />
{/if}

<style>
  canvas {
    display: none;
  }

  .image-qrcode-input {
    margin-top: 20px;
  }
</style>
