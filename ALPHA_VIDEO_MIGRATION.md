# Alpha Video Rendering Notes

## Current State

The homepage pet stage now uses only one rendering path:

1. `wx.createVideoDecoder()` decodes a standard H.264 MP4.
2. The decoded frame is uploaded to `canvas#petVideoCanvas` as a WebGL texture.
3. A fragment shader reads RGB from the left half of the frame and alpha from the right half.

The old PNG frame animation fallback has been removed from the homepage render path. The old `components/alpha-video` component has also been removed because hidden native `<video>` plus Canvas `drawImage` was not reliable enough in the mini program runtime.

## Active Asset

Current cloud video:

```text
cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/xiaotuanzi-idle-alpha-pack-h.mp4
```

Format:

- Codec: H.264
- Pixel format: `yuv420p`
- Dimensions: `1440x960`
- Layout: horizontal dual channel
- Left half: RGB image, `720x960`
- Right half: alpha mask, `720x960`
- Size: about `2.4 MB`

This is intentionally not HEVC alpha. The previous `HEVC（Alpha）版本.mp4` probed as HEVC Main / `yuv420p` with no alpha stream, and the mini program decoder reported `not supported`.

## Verification

Use the console logs in `miniprogram/pages/index/index.ts` to verify the actual path:

- `alpha video start requested`: selected video URL.
- `alpha video cloud source resolved`: cloud file downloaded to a temp path.
- `alpha video decoder started`: decoder accepted the file.
- `alpha video first frame`: frame dimensions and byte length.
- `alpha video mask samples`: confirms the right half of the MP4 contains usable black/white alpha-mask values.

For the current shader path to be valid, the first frame log should show `byteLength === width * height * 4`. If it logs `alpha video frame is not RGBA sized`, `getFrameData()` is returning a non-RGBA buffer and the renderer needs a YUV/NV12 upload path instead of the current RGBA texture upload.

## Asset Creation Command

The current H.264 dual-channel video was generated from a VP9 alpha WebM using `libvpx-vp9` so ffmpeg can read the alpha plane:

```bash
/usr/local/bin/ffmpeg -y \
  -c:v libvpx-vp9 \
  -i "/Users/huangchangwei/Downloads/生成布偶猫视频_transparent_fixed.webm" \
  -filter_complex "[0:v]format=rgba,split=2[rgbsrc][alphasrc];[rgbsrc]format=rgb24[rgb];[alphasrc]alphaextract,format=gray,format=rgb24[alpha];[rgb][alpha]hstack=inputs=2,scale=1440:960:flags=lanczos,format=yuv420p[v]" \
  -map "[v]" \
  -an \
  -r 24 \
  -c:v libx264 \
  -preset medium \
  -crf 20 \
  -profile:v high \
  -level 4.1 \
  -movflags +faststart \
  /tmp/petllt-alpha-test/xiaotuanzi-idle-alpha-pack-h.mp4
```

Upload:

```bash
npm run upload:alpha-video -- /tmp/petllt-alpha-test/xiaotuanzi-idle-alpha-pack-h.mp4 --apply
```
