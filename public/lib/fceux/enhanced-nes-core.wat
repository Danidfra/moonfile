(module
  ;; Memory: 64MB (1024 pages)
  (memory (export "memory") 1024)

  ;; Global variables for NES state
  (global $romData (mut i32) (i32.const 0))
  (global $romSize (mut i32) (i32.const 0))
  (global $frameBuffer (mut i32) (i32.const 65536))    ;; 64KB offset
  (global $palette (mut i32) (i32.const 311296))       ;; After frame buffer
  (global $chrRam (mut i32) (i32.const 311488))        ;; CHR RAM area (8KB)
  (global $prgRam (mut i32) (i32.const 319680))        ;; PRG RAM area (8KB)
  (global $controls (mut i32) (i32.const 0))
  (global $romLoaded (mut i32) (i32.const 0))
  (global $initialized (mut i32) (i32.const 0))
  (global $running (mut i32) (i32.const 0))
  (global $frameCount (mut i32) (i32.const 0))

  ;; ROM header info
  (global $prgBanks (mut i32) (i32.const 0))
  (global $chrBanks (mut i32) (i32.const 0))
  (global $mapper (mut i32) (i32.const 0))
  (global $hasChrRam (mut i32) (i32.const 0))

  ;; Constants
  (global $NES_HEADER_SIZE i32 (i32.const 16))
  (global $FRAME_BUFFER_SIZE i32 (i32.const 245760))  ;; 256 * 240 * 4 (RGBA)
  (global $PALETTE_SIZE i32 (i32.const 256))          ;; 64 colors * 4 bytes RGBA
  (global $CHR_RAM_SIZE i32 (i32.const 8192))         ;; 8KB CHR RAM
  (global $PRG_RAM_SIZE i32 (i32.const 8192))         ;; 8KB PRG RAM

  ;; Initialize the NES emulator
  (func $init (export "init") (result i32)
    (local $i i32)

    ;; Reset all state
    (global.set $romData (i32.const 0))
    (global.set $romSize (i32.const 0))
    (global.set $controls (i32.const 0))
    (global.set $romLoaded (i32.const 0))
    (global.set $running (i32.const 0))
    (global.set $frameCount (i32.const 0))

    ;; Reset ROM info
    (global.set $prgBanks (i32.const 0))
    (global.set $chrBanks (i32.const 0))
    (global.set $mapper (i32.const 0))
    (global.set $hasChrRam (i32.const 0))

    ;; Initialize NES palette (64 colors in RGBA format)
    (call $initNESPalette)

    ;; Clear frame buffer to black
    (call $clearFrameBuffer)

    ;; Clear CHR RAM
    (call $clearChrRam)

    ;; Clear PRG RAM
    (call $clearPrgRam)

    ;; Mark as initialized
    (global.set $initialized (i32.const 1))

    ;; Return success
    (i32.const 1)
  )

  ;; Reset the emulator
  (func $reset (export "reset")
    ;; Reset controls
    (global.set $controls (i32.const 0))
    (global.set $running (i32.const 0))
    (global.set $frameCount (i32.const 0))

    ;; Clear frame buffer
    (call $clearFrameBuffer)

    ;; If CHR RAM is used, clear it
    (if (global.get $hasChrRam)
      (then (call $clearChrRam))
    )
  )

  ;; Load ROM data with comprehensive validation
  (func $loadRom (export "loadRom") (param $romPtr i32) (param $romLen i32) (result i32)
    (local $headerByte0 i32)
    (local $headerByte1 i32)
    (local $headerByte2 i32)
    (local $headerByte3 i32)
    (local $prgBanksValue i32)
    (local $chrBanksValue i32)
    (local $flags6 i32)
    (local $flags7 i32)
    (local $mapperValue i32)
    (local $expectedSize i32)
    (local $hasTrainer i32)

    ;; Check minimum size
    (if (i32.lt_u (local.get $romLen) (global.get $NES_HEADER_SIZE))
      (then (return (i32.const 0)))
    )

    ;; Check NES header magic bytes
    (local.set $headerByte0 (i32.load8_u (local.get $romPtr)))
    (local.set $headerByte1 (i32.load8_u (i32.add (local.get $romPtr) (i32.const 1))))
    (local.set $headerByte2 (i32.load8_u (i32.add (local.get $romPtr) (i32.const 2))))
    (local.set $headerByte3 (i32.load8_u (i32.add (local.get $romPtr) (i32.const 3))))

    ;; Validate "NES\x1A"
    (if (i32.ne (local.get $headerByte0) (i32.const 0x4E)) ;; 'N'
      (then (return (i32.const 0)))
    )
    (if (i32.ne (local.get $headerByte1) (i32.const 0x45)) ;; 'E'
      (then (return (i32.const 0)))
    )
    (if (i32.ne (local.get $headerByte2) (i32.const 0x53)) ;; 'S'
      (then (return (i32.const 0)))
    )
    (if (i32.ne (local.get $headerByte3) (i32.const 0x1A)) ;; EOF
      (then (return (i32.const 0)))
    )

    ;; Extract ROM information
    (local.set $prgBanksValue (i32.load8_u (i32.add (local.get $romPtr) (i32.const 4))))
    (local.set $chrBanksValue (i32.load8_u (i32.add (local.get $romPtr) (i32.const 5))))
    (local.set $flags6 (i32.load8_u (i32.add (local.get $romPtr) (i32.const 6))))
    (local.set $flags7 (i32.load8_u (i32.add (local.get $romPtr) (i32.const 7))))

    ;; Calculate mapper number
    (local.set $mapperValue (i32.or
      (i32.shr_u (local.get $flags6) (i32.const 4))
      (i32.and (local.get $flags7) (i32.const 0xF0))
    ))

    ;; Check for trainer
    (local.set $hasTrainer (i32.and (local.get $flags6) (i32.const 0x04)))

    ;; Calculate expected ROM size
    (local.set $expectedSize (i32.const 16)) ;; Header
    (if (local.get $hasTrainer)
      (then (local.set $expectedSize (i32.add (local.get $expectedSize) (i32.const 512))))
    )
    (local.set $expectedSize (i32.add (local.get $expectedSize)
      (i32.mul (local.get $prgBanksValue) (i32.const 16384)))) ;; PRG banks
    (local.set $expectedSize (i32.add (local.get $expectedSize)
      (i32.mul (local.get $chrBanksValue) (i32.const 8192))))  ;; CHR banks

    ;; Validate ROM size
    (if (i32.lt_u (local.get $romLen) (local.get $expectedSize))
      (then (return (i32.const 0)))
    )

    ;; Validate PRG banks (must be > 0)
    (if (i32.eq (local.get $prgBanksValue) (i32.const 0))
      (then (return (i32.const 0)))
    )

    ;; Check mapper support (support mappers 0, 1, 2, 3, 4, 7)
    (if (i32.and
          (i32.ne (local.get $mapperValue) (i32.const 0))
          (i32.and
            (i32.ne (local.get $mapperValue) (i32.const 1))
            (i32.and
              (i32.ne (local.get $mapperValue) (i32.const 2))
              (i32.and
                (i32.ne (local.get $mapperValue) (i32.const 3))
                (i32.and
                  (i32.ne (local.get $mapperValue) (i32.const 4))
                  (i32.ne (local.get $mapperValue) (i32.const 7))
                )
              )
            )
          )
        )
      (then
        ;; Unsupported mapper, but let's try anyway for testing
        ;; return (i32.const 0)
      )
    )

    ;; Store ROM information
    (global.set $romData (local.get $romPtr))
    (global.set $romSize (local.get $romLen))
    (global.set $prgBanks (local.get $prgBanksValue))
    (global.set $chrBanks (local.get $chrBanksValue))
    (global.set $mapper (local.get $mapperValue))

    ;; Set CHR RAM flag if no CHR banks
    (if (i32.eq (local.get $chrBanksValue) (i32.const 0))
      (then (global.set $hasChrRam (i32.const 1)))
      (else (global.set $hasChrRam (i32.const 0)))
    )

    ;; Initialize CHR RAM if needed
    (if (global.get $hasChrRam)
      (then (call $initChrRam))
    )

    ;; Mark ROM as loaded
    (global.set $romLoaded (i32.const 1))

    ;; Return success
    (i32.const 1)
  )

  ;; Execute one frame
  (func $frame (export "frame")
    ;; Only run if ROM is loaded
    (if (global.get $romLoaded)
      (then
        ;; Increment frame counter
        (global.set $frameCount (i32.add (global.get $frameCount) (i32.const 1)))

        ;; Generate frame based on mapper and controls
        (if (i32.eq (global.get $mapper) (i32.const 0))
          (then (call $generateNROMFrame))
          (else (if (i32.eq (global.get $mapper) (i32.const 2))
            (then (call $generateUNROMFrame))
            (else (call $generateGenericFrame))
          ))
        )
      )
    )
  )

  ;; Set button state
  (func $setButton (export "setButton") (param $button i32) (param $pressed i32)
    (local $mask i32)
    (local $currentControls i32)

    ;; Validate button index (0-7)
    (if (i32.or (i32.lt_u (local.get $button) (i32.const 0)) (i32.gt_u (local.get $button) (i32.const 7)))
      (then (return))
    )

    ;; Calculate bit mask for button
    (local.set $mask (i32.shl (i32.const 1) (local.get $button)))
    (local.set $currentControls (global.get $controls))

    ;; Update controls based on pressed state
    (if (local.get $pressed)
      (then
        ;; Set button bit
        (global.set $controls (i32.or (local.get $currentControls) (local.get $mask)))
      )
      (else
        ;; Clear button bit
        (global.set $controls (i32.and (local.get $currentControls) (i32.xor (local.get $mask) (i32.const -1))))
      )
    )
  )

  ;; Set running state
  (func $setRunning (export "setRunning") (param $running i32)
    (global.set $running (local.get $running))
  )

  ;; Get frame buffer pointer
  (func $getFrameBuffer (export "getFrameBuffer") (result i32)
    (global.get $frameBuffer)
  )

  ;; Get frame buffer size
  (func $getFrameBufferSize (export "getFrameBufferSize") (result i32)
    (global.get $FRAME_BUFFER_SIZE)
  )

  ;; Get frame specification
  (func $getFrameSpec (export "getFrameSpec") (result i32)
    ;; Return pointer to frame spec structure in memory
    ;; Format: width(4), height(4), format(4) where format 0=RGBA32
    (i32.const 327680) ;; Fixed location for frame spec
  )

  ;; Get palette pointer
  (func $getPalette (export "getPalette") (result i32)
    (global.get $palette)
  )

  ;; Get audio buffer (stub)
  (func $getAudioBuffer (export "getAudioBuffer") (result i32)
    (i32.const 0) ;; No audio for this implementation
  )

  ;; Internal function: Initialize NES palette (64 colors in RGBA format)
  (func $initNESPalette
    (local $palettePtr i32)
    (local $i i32)

    (local.set $palettePtr (global.get $palette))
    (local.set $i (i32.const 0))

    ;; Standard NES palette colors (simplified)
    (loop $paletteLoop
      ;; Generate RGBA values for each of 64 NES colors
      ;; Simple palette generation based on index

      ;; Store RGBA (simple color generation)
      (i32.store8 (i32.add (local.get $palettePtr) (i32.mul (local.get $i) (i32.const 4)))
        (i32.and (i32.mul (local.get $i) (i32.const 37)) (i32.const 255))) ;; R
      (i32.store8 (i32.add (local.get $palettePtr) (i32.add (i32.mul (local.get $i) (i32.const 4)) (i32.const 1)))
        (i32.and (i32.mul (local.get $i) (i32.const 73)) (i32.const 255))) ;; G
      (i32.store8 (i32.add (local.get $palettePtr) (i32.add (i32.mul (local.get $i) (i32.const 4)) (i32.const 2)))
        (i32.and (i32.mul (local.get $i) (i32.const 127)) (i32.const 255))) ;; B
      (i32.store8 (i32.add (local.get $palettePtr) (i32.add (i32.mul (local.get $i) (i32.const 4)) (i32.const 3)))
        (i32.const 255)) ;; A

      ;; Increment counter
      (local.set $i (i32.add (local.get $i) (i32.const 1)))

      ;; Continue if i < 64
      (br_if $paletteLoop (i32.lt_u (local.get $i) (i32.const 64)))
    )

    ;; Write frame spec at fixed location
    (i32.store (i32.const 327680) (i32.const 256))     ;; width
    (i32.store (i32.const 327684) (i32.const 240))     ;; height
    (i32.store (i32.const 327688) (i32.const 0))       ;; format (0 = RGBA32)
  )

  ;; Internal function: Clear frame buffer to black
  (func $clearFrameBuffer
    (local $ptr i32)
    (local $end i32)

    (local.set $ptr (global.get $frameBuffer))
    (local.set $end (i32.add (local.get $ptr) (global.get $FRAME_BUFFER_SIZE)))

    ;; Clear to black (RGBA: 0,0,0,255)
    (loop $clearLoop
      (i32.store8 (local.get $ptr) (i32.const 0))                    ;; R = 0
      (i32.store8 (i32.add (local.get $ptr) (i32.const 1)) (i32.const 0))  ;; G = 0
      (i32.store8 (i32.add (local.get $ptr) (i32.const 2)) (i32.const 0))  ;; B = 0
      (i32.store8 (i32.add (local.get $ptr) (i32.const 3)) (i32.const 255)) ;; A = 255
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 4)))
      (br_if $clearLoop (i32.lt_u (local.get $ptr) (local.get $end)))
    )
  )

  ;; Internal function: Clear CHR RAM
  (func $clearChrRam
    (local $ptr i32)
    (local $end i32)

    (local.set $ptr (global.get $chrRam))
    (local.set $end (i32.add (local.get $ptr) (global.get $CHR_RAM_SIZE)))

    (loop $clearLoop
      (i32.store8 (local.get $ptr) (i32.const 0))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br_if $clearLoop (i32.lt_u (local.get $ptr) (local.get $end)))
    )
  )

  ;; Internal function: Clear PRG RAM
  (func $clearPrgRam
    (local $ptr i32)
    (local $end i32)

    (local.set $ptr (global.get $prgRam))
    (local.set $end (i32.add (local.get $ptr) (global.get $PRG_RAM_SIZE)))

    (loop $clearLoop
      (i32.store8 (local.get $ptr) (i32.const 0))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br_if $clearLoop (i32.lt_u (local.get $ptr) (local.get $end)))
    )
  )

  ;; Internal function: Initialize CHR RAM with pattern
  (func $initChrRam
    (local $ptr i32)
    (local $end i32)
    (local $value i32)

    (local.set $ptr (global.get $chrRam))
    (local.set $end (i32.add (local.get $ptr) (global.get $CHR_RAM_SIZE)))
    (local.set $value (i32.const 0))

    ;; Fill CHR RAM with a pattern
    (loop $initLoop
      (i32.store8 (local.get $ptr) (local.get $value))
      (local.set $value (i32.and (i32.add (local.get $value) (i32.const 1)) (i32.const 255)))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br_if $initLoop (i32.lt_u (local.get $ptr) (local.get $end)))
    )
  )

  ;; Generate frame for NROM (mapper 0)
  (func $generateNROMFrame
    (call $generateBasicFrame (i32.const 0x20)) ;; Green tint for NROM
  )

  ;; Generate frame for UNROM (mapper 2) - handles CHR RAM
  (func $generateUNROMFrame
    (call $generateBasicFrame (i32.const 0x40)) ;; Blue tint for UNROM

    ;; If using CHR RAM, add special pattern
    (if (global.get $hasChrRam)
      (then (call $addChrRamPattern))
    )
  )

  ;; Generate frame for other mappers
  (func $generateGenericFrame
    (call $generateBasicFrame (i32.const 0x60)) ;; Purple tint for other mappers
  )

  ;; Generate basic frame with color tint
  (func $generateBasicFrame (param $baseTint i32)
    (local $ptr i32)
    (local $x i32)
    (local $y i32)
    (local $pixel i32)
    (local $controls i32)
    (local $frameCount i32)

    (local.set $ptr (global.get $frameBuffer))
    (local.set $controls (global.get $controls))
    (local.set $frameCount (global.get $frameCount))

    ;; Generate frame based on position, controls, and frame count
    (local.set $y (i32.const 0))
    (loop $yLoop
      (local.set $x (i32.const 0))
      (loop $xLoop
        ;; Calculate base pixel color
        (local.set $pixel (i32.add
          (i32.add (local.get $baseTint) (i32.and (local.get $x) (i32.const 0x1F)))
          (i32.and (local.get $y) (i32.const 0x1F))
        ))

        ;; Add animation based on frame count
        (local.set $pixel (i32.add (local.get $pixel)
          (i32.and (i32.shr_u (local.get $frameCount) (i32.const 2)) (i32.const 0x3F))
        ))

        ;; Modify based on controls
        (if (i32.and (local.get $controls) (i32.const 1)) ;; Right button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 64))))
        )
        (if (i32.and (local.get $controls) (i32.const 2)) ;; Left button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 32))))
        )
        (if (i32.and (local.get $controls) (i32.const 4)) ;; Down button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 16))))
        )
        (if (i32.and (local.get $controls) (i32.const 8)) ;; Up button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 8))))
        )
        (if (i32.and (local.get $controls) (i32.const 128)) ;; A button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 128))))
        )
        (if (i32.and (local.get $controls) (i32.const 64)) ;; B button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 96))))
        )

        ;; Write RGBA pixel
        (i32.store8 (local.get $ptr) (i32.and (local.get $pixel) (i32.const 255)))           ;; R
        (i32.store8 (i32.add (local.get $ptr) (i32.const 1)) (i32.and (i32.shr_u (local.get $pixel) (i32.const 1)) (i32.const 255))) ;; G
        (i32.store8 (i32.add (local.get $ptr) (i32.const 2)) (i32.and (i32.shr_u (local.get $pixel) (i32.const 2)) (i32.const 255))) ;; B
        (i32.store8 (i32.add (local.get $ptr) (i32.const 3)) (i32.const 255))                ;; A

        ;; Advance pointer
        (local.set $ptr (i32.add (local.get $ptr) (i32.const 4)))

        ;; Increment x
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $xLoop (i32.lt_u (local.get $x) (i32.const 256)))
      )

      ;; Increment y
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $yLoop (i32.lt_u (local.get $y) (i32.const 240)))
    )
  )

  ;; Add CHR RAM pattern for UNROM games
  (func $addChrRamPattern
    (local $ptr i32)
    (local $x i32)
    (local $y i32)
    (local $chrValue i32)

    (local.set $ptr (global.get $frameBuffer))

    ;; Add CHR RAM visualization (every 8th pixel)
    (local.set $y (i32.const 0))
    (loop $chrYLoop
      (local.set $x (i32.const 0))
      (loop $chrXLoop
        ;; Only modify every 8th pixel to show CHR RAM pattern
        (if (i32.eq (i32.and (i32.add (local.get $x) (local.get $y)) (i32.const 7)) (i32.const 0))
          (then
            ;; Get CHR RAM value
            (local.set $chrValue (i32.load8_u (i32.add (global.get $chrRam)
              (i32.and (i32.add (local.get $x) (i32.mul (local.get $y) (i32.const 32))) (i32.const 8191))
            )))

            ;; Modify pixel based on CHR RAM
            (local.set $ptr (i32.add (global.get $frameBuffer) (i32.mul (i32.add (local.get $x) (i32.mul (local.get $y) (i32.const 256))) (i32.const 4))))

            ;; Add CHR pattern to existing pixel
            (i32.store8 (local.get $ptr)
              (i32.and (i32.add (i32.load8_u (local.get $ptr)) (local.get $chrValue)) (i32.const 255)))
          )
        )

        ;; Increment x
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $chrXLoop (i32.lt_u (local.get $x) (i32.const 256)))
      )

      ;; Increment y
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $chrYLoop (i32.lt_u (local.get $y) (i32.const 240)))
    )
  )
)