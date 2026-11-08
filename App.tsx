import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initAudio } from './src/audio/sound';
import { CPU_LEVEL_INFO } from './src/characters';
import { survivalLevel } from './src/game/cpu';
import { ROBOT_SURVIVAL_HEAL } from './src/game/robot';
import { getRobotHp } from './src/settings';
import { CharacterSelectScreen } from './src/screens/CharacterSelectScreen';
import { GameScreen } from './src/screens/GameScreen';
import { MergeScreen } from './src/screens/MergeScreen';
import { RobotBattleScreen } from './src/screens/RobotBattleScreen';
import { ModeSelectScreen } from './src/screens/ModeSelectScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { RuleSelectScreen } from './src/screens/RuleSelectScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { GameConfig, GameResult, Phase } from './src/types';

const DEFAULT_CONFIG: GameConfig = { mode: 'vs2p', rule: 'normal', p1Animal: 'dog', p2Animal: 'cat' };

export default function App() {
  const [phase, setPhase] = useState<Phase>('title');
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<GameResult>({ score1: 0, score2: 0, shots1: 0, shots2: 0 });
  // サバイバル: いま何人目の相手か(GameScreenのkeyにも使い、勝ち抜きで再マウントする)
  const [stage, setStage] = useState(1);

  useEffect(() => {
    initAudio();
  }, []);

  const startSurvivalRun = () => {
    setStage(1);
    setConfig((c) => ({
      ...c,
      survivalStage: 1,
      carryHp: undefined,
      p2Animal: CPU_LEVEL_INFO.turtle.animal,
    }));
  };

  const handleEnd = (r: GameResult) => {
    // サバイバルで勝ったら次の相手へ(途中終了は勝ち扱いにしない)
    const isSurvivalMode = config.mode === 'survival' || config.mode === 'robotSurvival';
    if (isSurvivalMode && !r.aborted && r.score1 > r.score2) {
      const next = stage + 1;
      setStage(next);
      setConfig((c) => ({
        ...c,
        survivalStage: next,
        p2Animal: CPU_LEVEL_INFO[survivalLevel(next)].animal,
        // ロボットバトル: HPを持ち越して少し回復(削られたまま次の相手へ)
        ...(config.mode === 'robotSurvival' && {
          carryHp: Math.min(getRobotHp(), r.score1 + ROBOT_SURVIVAL_HEAL),
        }),
      }));
      return; // phaseは'playing'のまま、keyの変更で次の試合が始まる
    }
    setResult(r);
    setPhase('result');
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      {phase === 'title' && <TitleScreen onStart={() => setPhase('mode')} />}
      {phase === 'mode' && (
        <ModeSelectScreen
          onSelect={(mode, cpuLevel, players) => {
            // 練習・ロボットバトルにバトルルールはないのでnormal固定でルール選択を飛ばす。
            // マージはルールもキャラ選択もないのですぐ始める
            const isRobot = mode === 'robot' || mode === 'robotSurvival';
            const skipRule = mode === 'practice' || mode === 'merge' || isRobot;
            setConfig((c) => ({
              ...c,
              mode,
              cpuLevel,
              players,
              carryHp: undefined, // サバイバルのHP持ち越しをリセット
              ...(skipRule && { rule: 'normal' as const }),
            }));
            if (mode === 'survival' || mode === 'robotSurvival') startSurvivalRun();
            setPhase(mode === 'merge' ? 'playing' : skipRule ? 'character' : 'rule');
          }}
          onBack={() => setPhase('title')}
        />
      )}
      {phase === 'rule' && (
        <RuleSelectScreen
          // ゾンビは対戦専用のアイテムモード以外を選べる(救世主アイテムは常にある)。
          // まとあては丸太が行進のジャマになりすぎるので ふつう/連射 のみ
          rules={
            config.mode === 'zombie'
              ? ['normal', 'rapid', 'gimmick']
              : config.mode === 'gallery'
                ? ['normal', 'rapid']
                : undefined
          }
          onSelect={(rule) => {
            setConfig((c) => ({ ...c, rule }));
            setPhase('character');
          }}
          onBack={() => setPhase('mode')}
        />
      )}
      {phase === 'character' && (
        <CharacterSelectScreen
          mode={config.mode}
          cpuLevel={config.cpuLevel}
          players={config.players}
          onConfirm={(p1Animal, p2Animal) => {
            setConfig((c) => ({ ...c, p1Animal, p2Animal }));
            setPhase('playing');
          }}
          onBack={() => setPhase(config.mode === 'practice' ? 'mode' : 'rule')}
        />
      )}
      {phase === 'playing' &&
        (config.mode === 'merge' ? (
          <MergeScreen config={config} onEnd={handleEnd} />
        ) : config.mode === 'robot' || config.mode === 'robotSurvival' ? (
          <RobotBattleScreen key={`robot-${stage}`} config={config} onEnd={handleEnd} />
        ) : (
          <GameScreen key={`game-${stage}`} config={config} onEnd={handleEnd} />
        ))}
      {phase === 'result' && (
        <ResultScreen
          config={config}
          result={result}
          onRematch={() => {
            // サバイバルの「もういちど」は1人目からやり直し
            if (config.mode === 'survival' || config.mode === 'robotSurvival') startSurvivalRun();
            setPhase('playing');
          }}
          onModeSelect={() => setPhase('mode')}
          onTitle={() => setPhase('title')}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
