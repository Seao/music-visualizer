$(() => {

  const FREQUENCIES = {
    TOTAL: 120,
    REDUCER: 0.7,
    BARS: {
      WIDTH: 5,
      COLOR: 'rgb(228, 134, 62)'
    }
  }

  const STAMP = {
    RADIUS: 150,
    SCALE: 0.4,
  }

  const audioContext = new AudioContext()

  // background video player
  videojs('background', {
    autoplay: true,
    muted: true
  }, function onPlayerReady() {  
    this.play()

    this.on('ended', function() {
      console.log('Ended')
      this.play()
    })
  })

  // request access to user microphone audio
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const source = audioContext.createMediaStreamSource(stream) // MediaStreamSourceNode
      const filter = audioContext.createBiquadFilter() // FilterNode
      const analyser = audioContext.createAnalyser() // AnalyserNode
      const scriptProcessor = audioContext.createScriptProcessor() // ScriptProcessorNode

      // set analyser configuration
      analyser.smoothingTimeConstant = 0.5
      analyser.fftSize = 256
      
      // connect the audio nodes
      source.connect(filter)

      filter.connect(analyser)
      filter.type = 'allpass'

      analyser.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      // create two instance
      const type = /(canvas|webgl)/.test(url.type) ? url.type : 'svg'
      const two = new Two({
        type: Two.Types[type],
        fullscreen: true
      }).appendTo(document.getElementById('canvas'))

      // instantiation of layers to manage overlays
      const background = two.makeGroup()
      const middleground = two.makeGroup()
      const foreground = two.makeGroup()

      /**
       * Creates the elements composing the stamp.
       */
      const createStamp = () => {
        const stamp = two.makeGroup()

        // main stamp shape
        const core = two.makeSprite('https://raw.githubusercontent.com/Seao/music-visualizer/development/assets/azeria.png')
        core.scale = 0.4

        stamp.core = core
        stamp.add(core)

        return stamp
      }

      /**
       * Affects a translational movement on the stamp to be centered on the screen.
       */
      const translateStamp = (stamp, scale = STAMP.SCALE) => {
        stamp.translation.set(two.width / 2, two.height / 2)
        stamp.core.scale = scale
      }

      // cascade execution of synchronous functions
      const flow = (...fns) => fns.reduceRight((acc, fn) => (...x) => acc = fn(...x))

      // Creates a mapping function that projects its input from a given range to another
      const remap = ([i0, i1], [o0, o1]) => i1 - i0 === 0
        ? () => NaN
        : (input) => (input - i0) / (i1 - i0) * (o1 - o0) + o0

      // Creates a clamping function that returns the closest value to the input within the given boundaries
      const clamp = (bounds) => (input) => {
        const [min, max] = bounds.slice().sort()
        return Math.max(min, Math.min(input, max))
      }

      const levelToScale = ({
        minLevel, maxLevel, minScale, maxScale,
      }) => flow(
        remap([minLevel, maxLevel], [minScale, maxScale]),
        Math.round,
        clamp([minScale, maxScale])
      )

      /**
       * Creates the elements allowing to visualize frenquencies from audio input.
       */
      const createFrequencies = () => {
        const frequencies = []
        for (let i = 0; i < FREQUENCIES.TOTAL; i++) {
          // create a single frequency line
          const createFrequencyLine = () => {
            const line = two.makeLine(0, 0, 0, 0)
            line.linewidth = FREQUENCIES.BARS.WIDTH
            line.stroke = FREQUENCIES.BARS.COLOR
            return line
          }

          const frequency = two.makeGroup()
          frequency.barLeft = createFrequencyLine()
          frequency.barRight = createFrequencyLine()

          frequency.add(frequency.barLeft)
          frequency.add(frequency.barRight)

          frequencies.push(frequency)
        }
        return frequencies
      }

      /**
       * Affects a translational movement on the frequency points of the array. This method is
       * used to adjust the levels of each point according to the analyze of the audio stream.
       */
      const translateFrequencies = (frequencies, { level = 0, levels = [] } = {}) => {
        // translate the line drawed for a frquency bar
        const translateFrequencyBar = (line, { theta, radiusMin, radiusMax } = {}) => {
          const weight = FREQUENCIES.BARS.WIDTH
          
          const minX = (radiusMin - weight) * Math.cos(theta)
          const minY = (radiusMin - weight) * Math.sin(theta)
          
          const maxX = (radiusMax - weight) * Math.cos(theta)
          const maxY = (radiusMax - weight) * Math.sin(theta)

          const [start, finish] = line.vertices
          start.set((two.width / 2) + minX, (two.height / 2) + minY)
          finish.set((two.width / 2) + maxX, (two.height / 2) + maxY)
        }
        
        frequencies.forEach((frequency, i) => {
          const theta = (pct) => (pct * Math.PI * 2) + (Math.PI + (Math.PI / 2))
          const radiusMin = STAMP.RADIUS
          const radiusMax = radiusMin + (levels[i] || level)
          
          const pctLeft = ((FREQUENCIES.TOTAL - ((i/2) + 1))) / FREQUENCIES.TOTAL
          translateFrequencyBar(frequency.barLeft, { radiusMin, radiusMax, theta: theta(pctLeft) })

          const pctRight = ((i/2) + 1) / FREQUENCIES.TOTAL
          translateFrequencyBar(frequency.barRight, { radiusMin, radiusMax, theta: theta(pctRight) })
        })
      }

      // create and translate stamp
      const stamp = createStamp()
      translateStamp(stamp)

      // create and translate frequencies
      const frequencies = createFrequencies()
      translateFrequencies(frequencies)

      // add elements in layers
      background.add(frequencies)
      middleground.add(stamp)

      // event handler to process audio input
      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        // create a new Uint8Array to store the analyser's frequencyBinCount 
        const data = new Uint8Array(analyser.frequencyBinCount)

        // get the byte frequency data from our array
        analyser.getByteFrequencyData(data)

        const { levels, total } = data
          .reduce((acc, level) => {
            const levelReduced = Math.pow(level * FREQUENCIES.REDUCER, 1.1)
            acc.levels.push(levelReduced)
            acc.total += levelReduced
            return acc
          }, { levels: [], total: 0 })

        const rate = levelToScale({ minLevel: 0, maxLevel: 18000, minScale: 0.3, maxScale: 0.55 })(total)

        translateFrequencies(frequencies, { levels })
        translateStamp(stamp, rate)
      }

      // render the scene
      two
        .bind('resize', () => {
          translateStamp(stamp)
          translateFrequencies(frequencies)
        })
        .play()

    }, error => {
      // something went wrong, or the browser does not support getUserMedia
    })
})