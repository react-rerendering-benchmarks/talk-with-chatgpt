import Button from "@material-ui/core/Button"
import Fab from "@material-ui/core/Fab/Fab"
import Icon from "@material-ui/core/Icon"
import IconButton from "@material-ui/core/IconButton/IconButton"
import makeStyles from "@material-ui/core/styles/makeStyles"
import AccessAlarmIcon from "@material-ui/icons/AccessAlarm"
import HeadsetIcon from "@material-ui/icons/Headset"
import KeyboardVoiceIcon from "@material-ui/icons/KeyboardVoice"
import SettingsIcon from "@material-ui/icons/Settings"
import TelegramIcon from "@material-ui/icons/Telegram"
import VolumeDownOutlinedIcon from '@material-ui/icons/VolumeDownOutlined';
import VolumeMuteIcon from "@material-ui/icons/VolumeMute"
import VolumeUpIcon from "@material-ui/icons/VolumeUp"
import iconBg from "data-base64:~assets/icon.png"
import playerControllerBg from "data-base64:~assets/playerController.png"
import recordPlayerBg from "data-base64:~assets/recordPlayer.png"
import styleText from "data-text:./content.module.css"
// import type { PlasmoCSConfig } from "plasmo"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

// import * as webkitSpeechRecognition from 'webkitSpeechRecognition';

import { useStorage } from "@plasmohq/storage/dist/hook"

import * as style from "./content.module.css"

declare var webkitSpeechRecognition: any
// declare var webkitSpeechGrammarList: any
// declare var webkitSpeechRecognitionEven: any
var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
// var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList
// var SpeechRecognitionEvent =
//   SpeechRecognitionEvent || webkitSpeechRecognitionEven
const synth = window.speechSynthesis
let currentPathName = location.pathname
let stopSpeechId = null
const sentenceSymbolReg =
  /[\u002c\u3001\u002e\u003f\u0021\u003b\u003a\u061b\u061f\u002e\u2026\uff01-\uff0f\uff1a-\uff1b\uff1f-\uff5e\u3002\uff0c\uff1f\uff01\uff1b\uff1a]/g
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}
enum playerStatus {
  BeforeListenVoice,
  ListenVoicing,
  SendChatMessage,
  Speechling,
  Speechend,
  SpeechPause,
  SpeechStop,
  SpeechContinue
}
let prevPlayerStatus: playerStatus = null

let isListening = false
export const config = {
  matches: ["https://chat.openai.com/chat*"]
}
let recognition = null
let utterance = null

function initListen({
  userLang,
  rate,
  pitch,
  answerLang,
  volume,
  recognitionStopWord,
  StopAnswerWord,
  currentPlayerStatus,
  setCurrentPlayerStatus
}) {
  function startListen() {
    clearInterval(stopSpeechId)
    synth.pause()
    synth.cancel()
    setCurrentPlayerStatus(playerStatus.ListenVoicing)
    if (!recognition) {
      recognition = new SpeechRecognition()
      recognition.start()
    }

    recognition.lang = userLang ? userLang : ""
    recognition.continuous = true
    // 获取当前浏览器支持的所有语言
    // console.log(window.speechSynthesis.getVoices())
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = true
    recognition.interimResults = true
    // recognition.onstart = true;
    recognition.onstart = function (event) {
      console.log("recognition start")
    }
    recognition.onresult = (event) => {
      const last = event.results.length - 1
      const text: string = event.results[last][0].transcript
      console.log({ text, event })
      const StopAnswerWordIndex = text
        .replace(/\s/g, "")
        .toLowerCase()
        .indexOf(StopAnswerWord.replace(/\s/g, "").toLowerCase())

      if (StopAnswerWordIndex > -1) {
        toStopAnswer(setCurrentPlayerStatus)
        return
      }
      if (!isListening) {
        return
      }
      const input = document.querySelector("textarea")
      const stopWordIndex = text.indexOf(recognitionStopWord)
      console.log({ event, text, last, recognitionStopWord, stopWordIndex })
      // 识别到停止关键字，就停止识别，并向chatGpt发送消息
      if (stopWordIndex > -1) {
        input.value += text.slice(0, stopWordIndex)
        sendMessage()
        return
      }
      input.value += text + " "
    }
    recognition.onnomatch = function (event) {
      console.log("recognition nomatch")
      recognition.abort()
    }
    recognition.onerror = function (event) {
      console.log("recognition error", event)
      // recognition.abort()
    }
    recognition.onend = function (event) {
      console.log("recognition end ")
      recognition.start()
    }
  }

  function startSpeechWork() {
    setCurrentPlayerStatus(playerStatus.Speechling)

    stopSpeechId = setInterval(() => {
      startSpeech({ volume, answerLang, rate, pitch }, setCurrentPlayerStatus)
    }, 500)
  }
  function sendMessage() {
    const input = document.querySelector("textarea")
    if (!input.value.trim()) {
      return
    }
    setCurrentPlayerStatus(playerStatus.SendChatMessage)
    const button = input.nextElementSibling
    ;(button as HTMLElement).click()
    startSpeechWork()
  }
  function speechPause(currentPlayerStatus) {
    prevPlayerStatus = currentPlayerStatus
    setCurrentPlayerStatus(playerStatus.SpeechPause)
    synth.pause()
  }
  function speechStop(currentPlayerStatus) {
    prevPlayerStatus = currentPlayerStatus
    clearInterval(stopSpeechId)
    setCurrentPlayerStatus(playerStatus.BeforeListenVoice)
    synth.cancel()
  }
  function speechContinue() {
    console.log({ prevPlayerStatus })
    setCurrentPlayerStatus(prevPlayerStatus)
    synth.resume()
  }
  return {
    startListen,
    startSpeechWork,
    sendMessage,
    speechPause,
    speechStop,
    speechContinue
  }
}
let prevMessageLen = 0
let prevText = ""
let currentMessageStep = 0
let currentMessageDom: Element = null
function startSpeech(
  { volume, answerLang, rate, pitch },
  setCurrentPlayerStatus
) {
  const currentMessage = document.querySelectorAll(".text-base")
  if (currentMessage.length > prevMessageLen) {
    prevMessageLen = currentMessage.length
    currentMessageStep = 0
    currentMessageDom = currentMessage[currentMessage.length - 1]
  }
  if (currentMessageDom) {
    const text = currentMessageDom.textContent
    if (text !== prevText) {
      prevText = text
      const sentences = text.split(sentenceSymbolReg)
      console.log(sentences, currentMessageStep)
      for (let i = currentMessageStep; i < sentences.length; i++) {
        // 如果sentences最后一项不是空字符串，说明当前段落还没结束
        if (
          currentMessageStep + 1 === sentences.length &&
          sentences[sentences.length - 1].trim() !== ""
        ) {
          return
        }
        if (sentences[i].trim()) {
          currentMessageStep += 1
          toSpeak(
            sentences[i],
            { volume, answerLang, rate, pitch },
            setCurrentPlayerStatus
          )
        }
      }
    }
  }
}
let toStopAnswerId = null
let toStopAnswerIdCount = 0
function toStopAnswer(setCurrentPlayerStatus) {
  toStopAnswerIdCount++
  const button = document
    .querySelector(".stretch")
    .querySelectorAll("button")[0]
  // 当用户说出stopAnswerWord的时候，并不一定有Stop generating按钮，所以需要等待出现按钮
  if (button.textContent === "Stop generating" || toStopAnswerIdCount >= 20) {
    toStopAnswerIdCount = 0
    button?.click()
    synth.cancel()
    setCurrentPlayerStatus(playerStatus.ListenVoicing)
    clearTimeout(toStopAnswerId)
  } else {
    toStopAnswerId = setTimeout(() => {
      clearTimeout(toStopAnswerId)
      toStopAnswer(setCurrentPlayerStatus)
    }, 100)
  }
}
function toSpeak(
  sentence,
  { volume, answerLang, rate, pitch },
  setCurrentPlayerStatus
) {
  if (utterance) {
    utterance.onend = null
    utterance = null
  }
  utterance = new SpeechSynthesisUtterance()
  // 语音播报
  utterance.volume = volume
  utterance.lang = answerLang
  utterance.rate = rate
  utterance.pitch = pitch
  utterance.text = sentence
  synth.speak(utterance)
  utterance.onend = () => {
    if (!synth.speaking) {
      setCurrentPlayerStatus(playerStatus.ListenVoicing)
    }
    console.log("synth.speaking", synth.speaking)
    console.log("utterance.onend")
  }
}

function initVarStatus(setCurrentPlayerStatus) {
  // 创建一个事件监听器，监听pathname变化
  // Todo: popstate event not be invoke
  // if someone know why,please contact with me or create a pr,thanks
  window.addEventListener("popstate", function () {
    console.log({ currentPathName })
    // 检查当前的pathname是否与存储的pathname不同
    if (window.location.pathname !== currentPathName) {
      setCurrentPlayerStatus(playerStatus.BeforeListenVoice)
      currentPathName = location.pathname
      prevMessageLen = 0
      prevText = ""
      currentMessageStep = 0
      currentMessageDom = null
    }
  })
}
let mountVolumeTimeID = null
function mountVolumeIcon({
  setCurrentPlayerStatus,
  volume,
  answerLang,
  rate,
  pitch
}) {
  mountVolumeTimeID = setTimeout(() => {
    clearTimeout(mountVolumeTimeID)
    const answerLineButtons = document.querySelectorAll(".self-end")
    answerLineButtons.forEach((dom) => {
      if ([...dom.children].some((d) => d.className.includes("volumeIcon"))) {
        return
      }
      const div = document.createElement("span")
      div.className = "volumeIcon"
      const root = createRoot(div)
      root.render(
        <VolumeIcon
          setCurrentPlayerStatus={setCurrentPlayerStatus}
          volume={volume}
          answerLang={answerLang}
          rate={rate}
          pitch={pitch}
        />
      )
      dom.appendChild(div)
    })
  }, 5000)
}
function VolumeIcon({
  setCurrentPlayerStatus,
  volume,
  answerLang,
  rate,
  pitch
}) {
  const [isPlay, setPlay] = useState(false)
  const volumeIcon = useRef(null)
  function onClick() {
    if (isPlay) {
      synth.cancel()
      setCurrentPlayerStatus(playerStatus.ListenVoicing)
    } else {
      setCurrentPlayerStatus(playerStatus.Speechling)
      const textContent = volumeIcon.current.closest(".text-base").textContent
      const sentences = textContent.split(sentenceSymbolReg)
      console.log(sentences)
      synth.resume()
      for (let i = 0; i < sentences.length; i++) {
        toSpeak(
          sentences[i],
          { volume, answerLang, rate, pitch },
          setCurrentPlayerStatus
        )
      }
    }
    setPlay(!isPlay)
  }
  return (
    <span
      style={{ cursor: "pointer" }}
      onClick={() => onClick()}
      ref={(ref) => {
        volumeIcon.current = ref
      }}>
      {isPlay ? <VolumeUpIcon /> : <VolumeDownOutlinedIcon />}
    </span>
  )
}
function IndexContent() {
  synth.cancel()

  const [bg] = useStorage<string>("recordPlayerBg", "")
  const [currentPlayerStatus, setCurrentPlayerStatus] = useStorage<number>(
    "currentPlayerStatus",
    playerStatus.BeforeListenVoice
  )

  useEffect(() => {
    initVarStatus(setCurrentPlayerStatus)
    setCurrentPlayerStatus(playerStatus.BeforeListenVoice)
    return () => {
      recognition?.abort()
      synth.cancel()
    }
  }, [])

  const [userLang] = useStorage<string>("userLang", "en-Us")
  const [rate] = useStorage<number>("speechRate", 1)
  const [pitch] = useStorage<number>("speechPitch", 1)
  const [answerLang] = useStorage<string>("answerLang", "")
  const [volume] = useStorage<number>("answerVolume", 1)
  const [recognitionStopWord] = useStorage("recognitionStopWord", "stop")
  const [StopAnswerWord] = useStorage("StopAnswerWord", "stop answer")
  mountVolumeIcon({ setCurrentPlayerStatus, volume, answerLang, rate, pitch })

  const {
    startListen,
    startSpeechWork,
    sendMessage,
    speechPause,
    speechStop,
    speechContinue
  } = initListen({
    userLang,
    rate,
    pitch,
    answerLang,
    volume,
    StopAnswerWord,
    recognitionStopWord,
    currentPlayerStatus,
    setCurrentPlayerStatus
  })
  useEffect(() => {
    isListening = currentPlayerStatus === playerStatus.ListenVoicing
  }, [currentPlayerStatus])
  function toggleStatus(isController) {
    // 点击控制器进行暂停或者恢复播放
    // 不会有监听用户说话的操作
    if (isController) {
      if (currentPlayerStatus === playerStatus.SpeechPause) {
        speechContinue()
        return
      } else {
        speechPause(currentPlayerStatus)
        return
      }
    }
    // 点击唱片中间，状态分别为
    // 开始监听用户说话
    // 监听完毕发送消息
    // 获取返回值并播放
    // 播放中如果再次点击是重新开始监听用户说话
    if (currentPlayerStatus === playerStatus.BeforeListenVoice) {
      startListen()
    } else if (currentPlayerStatus === playerStatus.ListenVoicing) {
      sendMessage()
    } else if (currentPlayerStatus === playerStatus.SendChatMessage) {
      startSpeechWork()
    } else if (currentPlayerStatus === playerStatus.Speechling) {
      startListen()
    }
  }

  const isUseAnimating = useMemo<boolean>(
    () =>
      ![
        playerStatus.BeforeListenVoice,
        // playerStatus.SendChatMessage,
        playerStatus.SpeechPause,
        playerStatus.SpeechStop,
        playerStatus.Speechend
      ].includes(currentPlayerStatus),
    [currentPlayerStatus]
  )

  return (
    <div className={style.talkContainer}>
      <img
        width={"100%"}
        className={[
          style.recordPlayer,
          isUseAnimating ? style.playerPlaying : ""
        ].join(" ")}
        src={recordPlayerBg}
        alt=""
      />
      <img
        className={[
          style.playerController,
          isUseAnimating ? style.controllerOnPlayer : ""
        ].join(" ")}
        onClick={() => toggleStatus(true)}
        src={playerControllerBg}
        alt=""
      />
      <div
        className={[style.innerContainer].join(" ")}
        onClick={() => toggleStatus(false)}>
        <img className={style.innerPlayerBg} src={bg ? bg : iconBg} alt="" />
        <StatusComponentIcon
          className={isUseAnimating ? style.breathBg : ""}
          currentPlayerStatus={currentPlayerStatus}></StatusComponentIcon>
      </div>
      <SettingsIcon
        className={`${style.settingsButton} ${
          isUseAnimating ? style.playerPlayingReverse : ""
        }`}
      />
    </div>
  )
}
export default IndexContent

function StatusComponentIcon({ currentPlayerStatus, className }) {
  const classNames = [style.innerPlayerBg, className].join(" ")

  return currentPlayerStatus === playerStatus.BeforeListenVoice ? (
    <KeyboardVoiceIcon
      className={classNames}
      style={{ backgroundColor: "rgba(135, 206, 235,0.2)" }}
    />
  ) : currentPlayerStatus === playerStatus.ListenVoicing ? (
    <KeyboardVoiceIcon className={classNames} />
  ) : currentPlayerStatus === playerStatus.SendChatMessage ? (
    <TelegramIcon className={classNames} />
  ) : currentPlayerStatus === playerStatus.Speechling ? (
    <HeadsetIcon className={classNames} />
  ) : currentPlayerStatus === playerStatus.SpeechPause ? (
    prevPlayerStatus > 2 ? (
      <HeadsetIcon
        className={classNames}
        style={{ backgroundColor: "rgba(135, 206, 235,0.2)" }}
      />
    ) : (
      <KeyboardVoiceIcon
        className={classNames}
        style={{ backgroundColor: "rgba(135, 206, 235,0.2)" }}
      />
    )
  ) : (
    <div> </div>
  )
}
