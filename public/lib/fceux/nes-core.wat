(module
  ;; Memory: 16MB (256 pages)
  (memory (export "memory") 256)
  
  ;; Global variables for NES state
  (global $romData (mut i32) (i32.const 0))
  (global $romSize (mut i32) (i32.const 0))
  (global $frameBuffer (mut i32) (i32.const 16384))
  (global $palette (mut i32) (i32.const 32768))
  (global $controls (mut i32) (i32.const 0))
  (global $romLoaded (mut i32) (i32.const 0))
  (global $initialized (mut i32) (i32.const 0))
  
  ;; Constants
  (global $NES_HEADER_SIZE i32 (i32.const 16))
  (global $FRAME_BUFFER_SIZE i32 (i32.const 245760))  ;; 256 * 240 * 4 (RGBA)
  (global $PALETTE_SIZE i32 (i32.const 192))          ;; 64 * 3 (RGB)
  
  ;; Initialize the NES emulator
  (func $init (export "init") (result i32)
    ;; Reset all state
    (global.set $romData (i32.const 0))
    (global.set $romSize (i32.const 0))
    (global.set $controls (i32.const 0))
    (global.set $romLoaded (i32.const 0))
    
    ;; Initialize NES palette
    (call $writePalette)
    
    ;; Clear frame buffer
    (call $clearFrameBuffer)
    
    ;; Mark as initialized
    (global.set $initialized (i32.const 1))
    
    ;; Return success
    (i32.const 1)
  )
  
  ;; Reset the emulator
  (func $reset (export "reset")
    ;; Reset controls
    (global.set $controls (i32.const 0))
    
    ;; Clear frame buffer
    (call $clearFrameBuffer)
  )
  
  ;; Load ROM data
  (func $loadRom (export "loadRom") (param $romPtr i32) (param $romLen i32) (result i32)
    (local $headerByte0 i32)
    (local $headerByte1 i32)
    (local $headerByte2 i32)
    (local $headerByte3 i32)
    
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
    
    ;; Store ROM info
    (global.set $romData (local.get $romPtr))
    (global.set $romSize (local.get $romLen))
    (global.set $romLoaded (i32.const 1))
    
    ;; Return success
    (i32.const 1)
  )
  
  ;; Execute one frame
  (func $frame (export "frame")
    ;; Only run if ROM is loaded
    (if (global.get $romLoaded)
      (then
        ;; Generate frame based on controls and ROM data
        (call $generateFrame)
      )
    )
  )
  
  ;; Set button state
  (func $setButton (export "setButton") (param $button i32) (param $pressed i32)
    (local $mask i32)
    (local $currentControls i32)
    
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
    ;; For this simple implementation, we don't need to track running state
    ;; In a full emulator, this would pause/unpause execution
  )
  
  ;; Get frame buffer pointer
  (func $getFrameBuffer (export "getFrameBuffer") (result i32)
    (global.get $frameBuffer)
  )
  
  ;; Get frame specification
  (func $getFrameSpec (export "getFrameSpec") (result i32)
    ;; Return pointer to a static frame spec structure
    ;; Format: width(4), height(4), format(4) where format 0=RGBA32
    (i32.const 65536) ;; Use a fixed location for frame spec
  )
  
  ;; Get palette pointer
  (func $getPalette (export "getPalette") (result i32)
    (global.get $palette)
  )
  
  ;; Get audio buffer (stub)
  (func $getAudioBuffer (export "getAudioBuffer") (result i32)
    (i32.const 0) ;; No audio for this simple implementation
  )
  
  ;; Internal function: Write NES palette
  (func $writePalette
    (local $palettePtr i32)
    (local $i i32)
    
    (local.set $palettePtr (global.get $palette))
    (local.set $i (i32.const 0))
    
    ;; Write a simple 64-color NES palette
    (loop $paletteLoop
      ;; Generate RGB values based on index
      (i32.store8 
        (i32.add (local.get $palettePtr) (i32.mul (local.get $i) (i32.const 3)))
        (i32.and (i32.mul (local.get $i) (i32.const 4)) (i32.const 255))
      )
      (i32.store8 
        (i32.add (local.get $palettePtr) (i32.add (i32.mul (local.get $i) (i32.const 3)) (i32.const 1)))
        (i32.and (i32.mul (local.get $i) (i32.const 8)) (i32.const 255))
      )
      (i32.store8 
        (i32.add (local.get $palettePtr) (i32.add (i32.mul (local.get $i) (i32.const 3)) (i32.const 2)))
        (i32.and (i32.mul (local.get $i) (i32.const 16)) (i32.const 255))
      )
      
      ;; Increment counter
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      
      ;; Continue if i < 64
      (br_if $paletteLoop (i32.lt_u (local.get $i) (i32.const 64)))
    )
    
    ;; Write frame spec at fixed location
    (i32.store (i32.const 65536) (i32.const 256))     ;; width
    (i32.store (i32.const 65540) (i32.const 240))     ;; height  
    (i32.store (i32.const 65544) (i32.const 0))       ;; format (0 = RGBA32)
  )
  
  ;; Internal function: Clear frame buffer
  (func $clearFrameBuffer
    (local $ptr i32)
    (local $end i32)
    
    (local.set $ptr (global.get $frameBuffer))
    (local.set $end (i32.add (local.get $ptr) (global.get $FRAME_BUFFER_SIZE)))
    
    ;; Clear to black
    (loop $clearLoop
      (i32.store8 (local.get $ptr) (i32.const 0))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br_if $clearLoop (i32.lt_u (local.get $ptr) (local.get $end)))
    )
  )
  
  ;; Internal function: Generate frame
  (func $generateFrame
    (local $ptr i32)
    (local $x i32)
    (local $y i32)
    (local $pixel i32)
    (local $controls i32)
    
    (local.set $ptr (global.get $frameBuffer))
    (local.set $controls (global.get $controls))
    
    ;; Generate a simple pattern based on controls
    (local.set $y (i32.const 0))
    (loop $yLoop
      (local.set $x (i32.const 0))
      (loop $xLoop
        ;; Calculate pixel color based on position and controls
        (local.set $pixel (i32.add 
          (i32.mul (local.get $x) (i32.const 2))
          (i32.mul (local.get $y) (i32.const 3))
        ))
        
        ;; Modify based on controls
        (if (i32.and (local.get $controls) (i32.const 1)) ;; Right button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 64))))
        )
        (if (i32.and (local.get $controls) (i32.const 2)) ;; Left button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 32))))
        )
        (if (i32.and (local.get $controls) (i32.const 128)) ;; A button
          (then (local.set $pixel (i32.add (local.get $pixel) (i32.const 128))))
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
)