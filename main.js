const gui = new dat.gui.GUI()

const LOGO = {
  SCALE: 0.4
}

const ARTIST = {
  NAME: 'NAME',
  FONT: {
    SIZE: 45,
    COLOR: '#FFF'
  }
}

const FREQUENCIES = {
  TOTAL: 256,
  SMOOTHING: 0.7,
  BARS: {
    WEIGHT: 2,
    COLOR: '#FFF',
    SPACE: 1024
  }
}

const audioContext = new AudioContext()

/**
 * VIDEO
 * - set background video player
 */

videojs('background', {
  autoplay: true,
  muted: true,
  loop: true,
}, function onPlayerReady() {  
  this.play()
})

/**
 * CANVAS
 * - create two.js instance for 2D graphical elements
 */

const two = new Two({
  type: Two.Types['svg'],
  fullscreen: true
}).appendTo(document.getElementById('canvas'))

// instantiation of layers to manage overlays
const background = two.makeGroup()
const middleground = two.makeGroup()

/**
 * UTILS
 */

// cascade execution of synchronous functions
const flow = (...fns) => fns.reduceRight((acc, fn) => (...x) => acc = fn(...x))

// creates a mapping function that projects its input from a given range to another
const remap = ([i0, i1], [o0, o1]) => i1 - i0 === 0
  ? () => NaN
  : (input) => (input - i0) / (i1 - i0) * (o1 - o0) + o0

// creates a clamping function that returns the closest value to the input within the given boundaries
const clamp = (bounds) => (input) => {
  const [min, max] = bounds.slice().sort()
  return Math.max(min, Math.min(input, max))
}

const isToThat = ({
  minIs, maxIs, minThat, maxThat,
}) => flow(
  remap([minIs, maxIs], [minThat, maxThat]),
  Math.round,
  clamp([minThat, maxThat])
)

/**
 * LOGO
 * - makes the graphical elements composing the logo
 * - creates utils functions to transform the logo
 */

const logo = two.makeGroup()

const sprite = two.makeSprite('https://raw.githubusercontent.com/Seao/music-visualizer/development/assets/logo.png')
sprite.scale = LOGO.SCALE
logo.add(sprite)

const artist = new Two.Text(ARTIST.NAME, 0, 0)
artist.fill = ARTIST.FONT.COLOR
artist.size = ARTIST.FONT.SIZE
artist.family = 'Raleway'
artist.weight = '600'
logo.add(artist)
 
const moveLogoToScreenCenter = () => {
  logo.translation.set(two.width / 2, two.height / 2)
}

const setLogoScale = (value) => { sprite.scale = value }

const setArtistName = (value) => { artist.value = value }
const setArtistFontSize = (value) => { artist.size = value }
const setArtistFontColor = (value) => { artist.fill = value }

moveLogoToScreenCenter()

middleground.add(logo)

/**
 * FREQUENCIES
 * - makes the graphical elements composing the frequencies
 * - creates utils functions to transform the frequencies
 */

const setFrequencyBarProperties = (bar = {}) => {
  bar.linewidth = FREQUENCIES.BARS.WEIGHT
  bar.stroke = FREQUENCIES.BARS.COLOR
} 

const frequencies = []
for (let i = 0; i < FREQUENCIES.TOTAL; i++) {
  // create a single frequency bar
  const createFrequencyBar = () => {
    const bar = two.makeLine(0, 0, 0, 0)
    setFrequencyBarProperties(bar)
    return bar
  }

  const frequency = two.makeGroup()
  
  frequency.left = createFrequencyBar()
  frequency.add(frequency.left)
  
  frequency.right = createFrequencyBar()
  frequency.add(frequency.right)

  frequencies.push(frequency)
}

const translateFrequencyBar = (bar, { theta, length } = {}) => {
  const weight = FREQUENCIES.BARS.WEIGHT
  const space = FREQUENCIES.BARS.SPACE * (LOGO.SCALE / 2.3)
  
  const minX = -(space - weight) * Math.cos(theta)
  const minY = -(space - weight) * Math.sin(theta)
  const maxX = ((space + length) - weight) * Math.cos(theta)
  const maxY = ((space + length) - weight) * Math.sin(theta)

  setFrequencyBarProperties(bar)

  const [start, finish] = bar.vertices
  start.set((two.width / 2) + minX, (two.height / 2) + minY)
  finish.set((two.width / 2) + maxX, (two.height / 2) + maxY)
}

const translateFrequencies = ({ level = 0, levels = [] } = {}) => {
  const thetaLeft = isToThat({ minIs: 0, maxIs: FREQUENCIES.TOTAL - 1, minThat: (Math.PI / 2) + Math.PI, maxThat: Math.PI / 2 })
  const thetaRight = isToThat({ minIs: 0, maxIs: FREQUENCIES.TOTAL - 1, minThat: (Math.PI / 2) + Math.PI, maxThat: (Math.PI / 2) + 2 * Math.PI })

  frequencies.forEach((frequency, i) => {
    const length = levels[i] || level
    translateFrequencyBar(frequency.left, { theta: thetaLeft(i), length })
    translateFrequencyBar(frequency.right, { theta: thetaRight(i), length })
  })
}

background.add(frequencies)

/**
 * CONTROLS
 * - intialize the GUI to control the display options of the page
 * - set controllers reacting to user changes in options
 */

const folderLogo = gui.addFolder('Logo');

const ctrlLogoScale = folderLogo.add(LOGO, 'SCALE', 0, 1.5)
ctrlLogoScale.onChange(setLogoScale)

const folderArtist = gui.addFolder('Artist');

const ctrlArtistName = folderArtist.add(ARTIST, 'NAME')
ctrlArtistName.onChange(setArtistName)

const ctrlArtistFontSize = folderArtist.add(ARTIST.FONT, 'SIZE', 12, 100)
ctrlArtistFontSize.onChange(setArtistFontSize)

const folderFrequencies = gui.addFolder('Frequencies');

const ctrlFrequenciesBarsColor = folderFrequencies.addColor(FREQUENCIES.BARS, 'COLOR')
const ctrlFrequenciesBarsWeight = folderFrequencies.add(FREQUENCIES.BARS, 'WEIGHT', 1, 5, 1)


/**
 * SCENE
 * - render the scene
 */

two
  .bind('resize', () => {
    moveLogoToScreenCenter()
  })
  .play()

/**
 * AUDIO PROCESSING
 * - request access to user microphone audio
 * - filter and analyse sound to animate graphical elements
 */

// request access to user microphone audio
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const source = audioContext.createMediaStreamSource(stream) // MediaStreamSourceNode
    const analyser = audioContext.createAnalyser() // AnalyserNode
    const scriptProcessor = audioContext.createScriptProcessor() // ScriptProcessorNode

    // set analyser configuration
    analyser.smoothingTimeConstant = FREQUENCIES.SMOOTHING
    analyser.fftSize = FREQUENCIES.TOTAL * 2

    // add gui controls
    const ctrlFrequenciesSmoothing = folderFrequencies.add(FREQUENCIES, 'SMOOTHING', 0, 1, 0.1)
    ctrlFrequenciesSmoothing.onChange((value) => { analyser.smoothingTimeConstant = value })

    // connect the audio nodes
    source.connect(analyser)
    analyser.connect(scriptProcessor)
    scriptProcessor.connect(audioContext.destination)

    // event handler to process audio input
    scriptProcessor.onaudioprocess = () => {
      // create a new Uint8Array to store the analyser's frequencyBinCount 
      const data = new Uint8Array(analyser.frequencyBinCount)

      // get the byte frequency data from our array
      analyser.getByteFrequencyData(data)

      const { levels, sum } = data
        .reduce((acc, level) => {
          acc.levels.push(level)
          acc.sum += level
          return acc
        }, { levels: [], sum: 0 })

      translateFrequencies({ levels })
    }
  }, (error) => {
    // something went wrong, or the browser does not support getUserMedia
  })