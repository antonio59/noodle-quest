import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '@/types';
import {
  MAX_LOSSES, COLORS, shuffle, canPlay, handScore,
  aiSelectCard, aiChooseColor, dealInitial,
  type UnoColor, type UnoCard, type AILevel, type GamePhase,
} from './logic';

const COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  wild: '#1e1e2e',
};

const SYMBOL_DISPLAY: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  skip: '⊘', reverse: '⟲', draw2: '+2', wild: '🌟',
};


function UnoGame({ stage, onScore, onProgress, onMessage, onEnd, aiDifficulty, multiplayerState, onMultiplayerMove }: GameProps & { aiDifficulty?: AILevel }) {
  const difficulty: AILevel = aiDifficulty || 'medium';
  const isOnline = !!multiplayerState;
  const mySeat = isOnline ? multiplayerState.playerNumber : 1;
  const oppSeat = isOnline ? (mySeat === 1 ? 2 : 1) : 2;
  const isHost = isOnline && multiplayerState.playerNumber === 1;

  const [playerHand, setPlayerHand] = useState<UnoCard[]>(() => dealInitial().pHand);
  const [aiHand, setAiHand] = useState<UnoCard[]>(() => dealInitial().aHand);
  const [deck, setDeck] = useState<UnoCard[]>(() => dealInitial().deck);
  const [discardPile, setDiscardPile] = useState<UnoCard[]>(() => dealInitial().discard);
  const [currentColor, setCurrentColor] = useState<UnoColor>(() => dealInitial().color);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [pendingCard, setPendingCard] = useState<UnoCard | null>(null);
  const [roundWins, setRoundWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [message, setMessage] = useState('Your turn! Play a card.');
  const [started, setStarted] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [, setLastPlayedBy] = useState<'player' | 'ai' | null>(null);
  const [highlightCard, setHighlightCard] = useState<number | null>(null);

  const targetWins = Math.max(1, stage + 1);
  const topCard = discardPile[discardPile.length - 1];

  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const winsRef = useRef(0);
  const lossesRef = useRef(0);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter(x => x !== id);
      if (!endedRef.current) fn();
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Online: host asks the server to deal — no client ever sees the deck
  // order or the opponent's cards.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!isOnline || !onMultiplayerMove || !isHost || seededRef.current) return;
    const bs = multiplayerState?.boardState as { hands?: unknown } | null | undefined;
    if (bs && bs.hands) return;
    seededRef.current = true;
    onMultiplayerMove({ action: 'deal' });
  }, [isOnline, onMultiplayerMove, isHost, multiplayerState]);

  // Online: reconcile from server boardState. Other hands and the deck
  // arrive as {hidden:true} placeholders — only their length is real.
  const passScheduledRef = useRef(false);
  const drewRef = useRef(false);
  useEffect(() => {
    if (!isOnline || !multiplayerState) return;
    const bs = multiplayerState.boardState as {
      hands?: Record<string, UnoCard[]>;
      deck?: UnoCard[];
      discard?: UnoCard[];
      color?: UnoColor;
      currentPlayer?: number;
      drew?: number;
    } | null | undefined;
    if (!bs || !bs.hands) return;
    const myHand = bs.hands[String(mySeat)] || [];
    const oppHand = bs.hands[String(oppSeat)] || [];
    setPlayerHand(myHand);
    setAiHand(oppHand);
    if (bs.deck) setDeck(bs.deck);
    if (bs.discard) setDiscardPile(bs.discard);
    if (bs.color) setCurrentColor(bs.color);
    setIsPlayerTurn(bs.currentPlayer === mySeat);
    drewRef.current = bs.drew === mySeat;

    // After our draw resolves, either play the drawn card or pass.
    if (bs.drew === mySeat && bs.currentPlayer === mySeat && myHand.length > 0) {
      if (!passScheduledRef.current) {
        passScheduledRef.current = true;
        const drawn = myHand[myHand.length - 1];
        const top = bs.discard?.[bs.discard.length - 1];
        const col = bs.color;
        if (drawn && top && col && !canPlay(drawn, top, col)) {
          schedule(() => {
            setMessage("No match. Opponent's turn.");
            onMultiplayerMove?.({ action: 'pass' });
          }, 700);
        } else {
          setMessage('You drew a playable card — tap it to play, or the deck to pass is automatic if it cannot be played.');
        }
      }
    } else {
      passScheduledRef.current = false;
    }

    // Winner check
    if (multiplayerState.winner && !endedRef.current) {
      endedRef.current = true;
      const iWon = multiplayerState.winner === mySeat;
      onEnd({ score: iWon ? 200 : 0, stars: iWon ? 3 : 1, summary: iWon ? 'You won UNO!' : 'Opponent won.' });
    }
  }, [isOnline, multiplayerState, mySeat, oppSeat, onEnd, onMultiplayerMove, schedule]);

  const finishMatch = useCallback((outcome: 'win' | 'lose') => {
    if (endedRef.current) return;
    endedRef.current = true;
    const finalWins = winsRef.current;
    const finalLosses = lossesRef.current;
    const stars = outcome === 'win'
      ? (finalLosses === 0 ? 3 : finalLosses === 1 ? 2 : 1)
      : (finalWins > 0 ? 2 : 1);
    const summary = outcome === 'win'
      ? `Won ${finalWins} of ${finalWins + finalLosses} UNO rounds!`
      : `AI won the match — ${finalWins} wins vs ${finalLosses} losses.`;
    onEnd({ score: finalWins * 150, stars, summary });
  }, [onEnd]);

  const drawCards = (currentDeck: UnoCard[], count: number, currentDiscard: UnoCard[] = discardPile): { drawn: UnoCard[]; remaining: UnoCard[] } => {
    if (currentDeck.length < count) {
      const reshuffled = shuffle(currentDiscard.slice(0, -1).concat(currentDeck));
      const drawn = reshuffled.slice(0, count);
      return { drawn, remaining: reshuffled.slice(count) };
    }
    return { drawn: currentDeck.slice(0, count), remaining: currentDeck.slice(count) };
  };

  const handleEndRound = (winner: 'player' | 'ai') => {
    if (endedRef.current) return;
    if (winner === 'player') {
      const opponentCards = handScore(aiHand);
      const newWins = winsRef.current + 1;
      winsRef.current = newWins;
      setRoundWins(newWins);
      onScore(opponentCards + 50);
      onProgress(newWins / targetWins);
      setMessage(`You won the round! +${opponentCards + 50} points`);
      onMessage(`Round won! ${newWins}/${targetWins}`);

      if (newWins >= targetWins) {
        setPhase('game-over');
        schedule(() => finishMatch('win'), 1500);
        return;
      }
    } else {
      const newLosses = lossesRef.current + 1;
      lossesRef.current = newLosses;
      setLosses(newLosses);
      setMessage(`AI won this round. ${newLosses}/${MAX_LOSSES} losses.`);
      onMessage(`AI won the round (${newLosses}/${MAX_LOSSES})`);
      if (newLosses >= MAX_LOSSES) {
        setPhase('game-over');
        schedule(() => finishMatch('lose'), 1500);
        return;
      }
    }
    setPhase('round-over');
  };

  const applyCardEffect = (card: UnoCard, playedBy: 'player' | 'ai', newDiscard: UnoCard[], newColor: UnoColor, newDeck: UnoCard[], pHand: UnoCard[], aHand: UnoCard[]) => {
    if (card.symbol === 'skip' || card.symbol === 'reverse') {
      if (playedBy === 'player') {
        return { pHand, aHand, deck: newDeck, discard: newDiscard, color: newColor, skip: true, message: `AI got skipped!` };
      } else {
        return { pHand, aHand, deck: newDeck, discard: newDiscard, color: newColor, skip: true, message: `You got skipped!` };
      }
    }

    if (card.symbol === 'draw2') {
      const { drawn, remaining } = drawCards(newDeck, 2, newDiscard);
      if (playedBy === 'player') {
        return { pHand, aHand: [...aHand, ...drawn], deck: remaining, discard: newDiscard, color: newColor, skip: true, message: 'AI draws 2 and is skipped!' };
      } else {
        return { pHand: [...pHand, ...drawn], aHand, deck: remaining, discard: newDiscard, color: newColor, skip: true, message: 'You draw 2 and are skipped!' };
      }
    }

    if (card.type === 'wild4') {
      const { drawn, remaining } = drawCards(newDeck, 4, newDiscard);
      if (playedBy === 'player') {
        return { pHand, aHand: [...aHand, ...drawn], deck: remaining, discard: newDiscard, color: newColor, skip: true, message: 'AI draws 4 and is skipped!' };
      } else {
        return { pHand: [...pHand, ...drawn], aHand, deck: remaining, discard: newDiscard, color: newColor, skip: true, message: 'You draw 4 and are skipped!' };
      }
    }

    return { pHand, aHand, deck: newDeck, discard: newDiscard, color: newColor, skip: false, message: playedBy === 'player' ? 'AI turn...' : 'Your turn!' };
  };

  const doAiTurn = (currentDeck: UnoCard[], currentDiscard: UnoCard[], currentColor_: UnoColor, currentAiHand: UnoCard[], currentPlayerHand: UnoCard[]) => {
    if (endedRef.current) return;
    setAiThinking(true);
    setMessage('AI is thinking...');

    schedule(() => {
      const topC = currentDiscard[currentDiscard.length - 1];
      const choice = aiSelectCard(currentAiHand, topC, currentColor_, difficulty);

      if (!choice) {
        const { drawn, remaining } = drawCards(currentDeck, 1, currentDiscard);
        const newAiHand = [...currentAiHand, ...drawn];

        const drawnCard = drawn[0];
        if (drawnCard && canPlay(drawnCard, topC, currentColor_)) {
          const aiHandAfter = newAiHand.filter(c => c.id !== drawnCard.id);
          const newDiscard = [...currentDiscard, drawnCard];
          const newColor = drawnCard.type === 'wild' || drawnCard.type === 'wild4'
            ? aiChooseColor(aiHandAfter, difficulty)
            : drawnCard.color as UnoColor;

          if (aiHandAfter.length === 0) {
            setAiHand(aiHandAfter);
            setDiscardPile(newDiscard);
            setCurrentColor(newColor);
            setDeck(remaining);
            setAiThinking(false);
            handleEndRound('ai');
            return;
          }

          const effect = applyCardEffect(drawnCard, 'ai', newDiscard, newColor, remaining, currentPlayerHand, aiHandAfter);

          setPlayerHand(effect.pHand);
          setAiHand(effect.aHand);
          setDiscardPile(effect.discard);
          setCurrentColor(effect.color);
          setDeck(effect.deck);
          setMessage(effect.message);
          setAiThinking(false);

          if (effect.skip) {
            schedule(() => doAiTurn(effect.deck, effect.discard, effect.color, effect.aHand, effect.pHand), 800);
          } else {
            setIsPlayerTurn(true);
          }
        } else {
          setAiHand(newAiHand);
          setDeck(remaining);
          setMessage('AI drew a card. Your turn!');
          setIsPlayerTurn(true);
          setAiThinking(false);
        }
        return;
      }

      const newAiHand = currentAiHand.filter(c => c.id !== choice.id);
      const newDiscard = [...currentDiscard, choice];
      const newColor = choice.type === 'wild' || choice.type === 'wild4'
        ? aiChooseColor(newAiHand, difficulty)
        : choice.color as UnoColor;

      if (newAiHand.length === 0) {
        setAiHand(newAiHand);
        setDiscardPile(newDiscard);
        setCurrentColor(newColor);
        setAiThinking(false);
        handleEndRound('ai');
        return;
      }

      setHighlightCard(choice.id);
      schedule(() => setHighlightCard(null), 600);

      const effect = applyCardEffect(choice, 'ai', newDiscard, newColor, currentDeck, currentPlayerHand, newAiHand);

      setPlayerHand(effect.pHand);
      setAiHand(effect.aHand);
      setDiscardPile(effect.discard);
      setCurrentColor(effect.color);
      setDeck(effect.deck);
      setMessage(effect.message);
      setLastPlayedBy('ai');
      setAiThinking(false);

      if (effect.skip) {
        schedule(() => doAiTurn(effect.deck, effect.discard, effect.color, effect.aHand, effect.pHand), 800);
      } else {
        setIsPlayerTurn(true);
      }
    }, 600 + Math.random() * 400);
  };

  const handlePlayCard = (card: UnoCard) => {
    if (!isPlayerTurn || phase !== 'playing' || aiThinking) return;
    if (!canPlay(card, topCard, currentColor)) {
      setMessage("Can't play that card!");
      return;
    }

    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingCard(card);
      setPhase('choosing-color');
      setMessage('Choose a color!');
      return;
    }

    playCardWithColor(card, card.color as UnoColor);
  };

  const playCardWithColor = (card: UnoCard, color: UnoColor) => {
    const newPlayerHand = playerHand.filter(c => c.id !== card.id);
    const newDiscard = [...discardPile, card];
    setPhase('playing');
    setPendingCard(null);
    setLastPlayedBy('player');

    setHighlightCard(card.id);
    schedule(() => setHighlightCard(null), 600);

    // Online: submit only our own hand + the new discard top. The server
    // validates the play against its copy of our hand, deals +2/+4
    // penalties to the opponent itself, and decides whose turn is next.
    if (isOnline && onMultiplayerMove) {
      const keepsTurn =
        card.symbol === 'skip' || card.symbol === 'reverse' ||
        card.symbol === 'draw2' || card.type === 'wild4';
      const won = newPlayerHand.length === 0;
      setPlayerHand(newPlayerHand);
      setDiscardPile(newDiscard);
      setCurrentColor(color);
      setIsPlayerTurn(keepsTurn && !won);
      setMessage(keepsTurn ? 'Skipped them — go again!' : "Opponent's turn.");
      onMultiplayerMove({
        boardState: {
          hands: { [mySeat]: newPlayerHand },
          discard: newDiscard,
          color,
        },
        winner: won ? mySeat : undefined,
      });
      if (won && !endedRef.current) {
        endedRef.current = true;
        onEnd({ score: 200, stars: 3, summary: 'You won UNO!' });
      }
      return;
    }

    if (newPlayerHand.length === 0) {
      setPlayerHand(newPlayerHand);
      setDiscardPile(newDiscard);
      setCurrentColor(color);
      handleEndRound('player');
      return;
    }

    const effect = applyCardEffect(card, 'player', newDiscard, color, deck, newPlayerHand, aiHand);

    setPlayerHand(effect.pHand);
    setAiHand(effect.aHand);
    setDiscardPile(effect.discard);
    setCurrentColor(effect.color);
    setDeck(effect.deck);
    setMessage(effect.message);

    if (effect.skip) {
      setMessage(effect.message + ' Your turn again!');
      setIsPlayerTurn(true);
    } else {
      setIsPlayerTurn(false);
      doAiTurn(effect.deck, effect.discard, effect.color, effect.aHand, effect.pHand);
    }
  };

  const handleChooseColor = (color: UnoColor) => {
    if (!pendingCard) return;
    playCardWithColor(pendingCard, color);
  };

  const handleDraw = () => {
    if (!isPlayerTurn || phase !== 'playing' || aiThinking) return;

    if (isOnline && onMultiplayerMove) {
      // The server draws for us and appends the card to our hand; the
      // reconcile effect then decides whether to pass. Tapping the deck
      // a second time (already drew) passes the turn.
      onMultiplayerMove({ action: drewRef.current ? 'pass' : 'draw' });
      return;
    }

    const { drawn, remaining } = drawCards(deck, 1);
    if (drawn.length === 0) return;

    const newPlayerHand = [...playerHand, drawn[0]];
    setDeck(remaining);
    setPlayerHand(newPlayerHand);

    const drawnCard = drawn[0];
    if (canPlay(drawnCard, topCard, currentColor)) {
      setMessage(`You drew ${cardLabel(drawnCard)} — you can play it!`);
    } else {
      setMessage("No match. AI's turn.");
      setIsPlayerTurn(false);
      doAiTurn(remaining, discardPile, currentColor, aiHand, newPlayerHand);
    }
  };

  const cardLabel = (card: UnoCard): string => {
    if (card.type === 'wild') return 'Wild';
    if (card.type === 'wild4') return 'Wild +4';
    return `${card.color} ${SYMBOL_DISPLAY[card.symbol]}`;
  };

  const startNewRound = () => {
    if (endedRef.current) return;
    const fresh = dealInitial();
    setPlayerHand(fresh.pHand);
    setAiHand(fresh.aHand);
    setDeck(fresh.deck);
    setDiscardPile(fresh.discard);
    setCurrentColor(fresh.color);
    setIsPlayerTurn(true);
    setPhase('playing');
    setPendingCard(null);
    setLastPlayedBy(null);
    setAiThinking(false);
    setMessage('New round! Your turn.');
  };

  const hasPlayableCard = playerHand.some(c => canPlay(c, topCard, currentColor));
  const isAdverseMessage = message.includes('skip') || (message.includes('draw') && message.includes('You'));
  if (!started && !isOnline) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-4 overflow-y-auto">
        <div className="text-5xl">🃏</div>
        <h2 className="text-2xl font-bold">UNO</h2>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Play all your cards before the AI does. First to win <span className="text-accent font-bold">{targetWins} round{targetWins !== 1 ? 's' : ''}</span> wins the match!
        </p>
        <div className="w-full max-w-xs bg-card rounded-2xl p-4 flex flex-col gap-2 ring-1 ring-white/10">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wide">How to play</span>
          <div className="flex flex-col gap-1.5 text-xs text-text-muted">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🎨</span>
              <span>Match the <span className="text-text font-semibold">color</span> or <span className="text-text font-semibold">number</span> of the top card to play</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">⊘</span>
              <span><span className="text-text font-semibold">Skip / Reverse</span> skips the opponent's turn</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">+2</span>
              <span><span className="text-text font-semibold">Draw 2</span> forces opponent to draw & lose their turn</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🌟</span>
              <span><span className="text-text font-semibold">Wild</span> lets you pick any color. Wild +4 also forces a draw!</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🃏</span>
              <span>No playable card? <span className="text-text font-semibold">Draw from the deck</span> — you can play it immediately if it matches</span>
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            {(['red','blue','green','yellow'] as UnoColor[]).map(c => (
              <div key={c} className="flex-1 h-5 rounded-full" style={{ background: COLOR_HEX[c] }} />
            ))}
          </div>
        </div>
        <button
          onClick={() => setStarted(true)}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }


  return (
    <div className="h-full flex flex-col items-center justify-between p-2 select-none overflow-hidden">
      {/* ── Top HUD ── */}
      <div className="w-full flex flex-col gap-1 flex-shrink-0">
        {/* Row 1: AI card count + round progress + loss counter */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-card rounded-lg px-2 py-1">
            <span className="text-text-muted">{isOnline ? (multiplayerState?.opponentName || 'Opp') : 'AI'}:</span>
            <span className="font-bold text-text">{aiHand.length}</span>
            <span className="text-text-muted">card{aiHand.length !== 1 ? 's' : ''}</span>
            {aiHand.length === 1 && (
              <span className="text-[10px] font-black text-yellow-400 animate-bounce">UNO!</span>
            )}
          </div>
          {/* Win progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: targetWins }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full border-2 transition-all ${
                  i < roundWins
                    ? 'bg-accent border-accent shadow-[0_0_6px_rgba(167,139,250,0.7)]'
                    : 'bg-transparent border-white/20'
                }`}
              />
            ))}
            <span className="text-[10px] text-text-muted ml-1">wins</span>
          </div>
          {/* Loss counter — always visible */}
          <div className="flex items-center gap-1 bg-card rounded-lg px-2 py-1">
            {Array.from({ length: MAX_LOSSES }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i < losses ? 'bg-red-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Row 2: Turn indicator */}
        <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold self-start ${
          isPlayerTurn && phase === 'playing'
            ? 'bg-accent/20 text-accent'
            : 'bg-card text-text-muted'
        }`}>
          {isPlayerTurn && phase === 'playing' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Your turn
            </>
          ) : (
            <>
              <span className="animate-pulse">🤖</span>
              {aiThinking ? 'AI thinking...' : "AI's turn"}
            </>
          )}
        </div>
      </div>

      {/* ── AI face-down hand (stacked display) ── */}
      <div className="relative flex items-center justify-center flex-shrink-0 h-16">
        {Array.from({ length: Math.min(aiHand.length, 7) }).map((_, i, arr) => (
          <div
            key={i}
            className="absolute w-10 h-14 rounded-md shadow-md"
            style={{
              background: 'linear-gradient(135deg, #2d1b69, #1a1a2e)',
              border: '1px solid #4a3f8a',
              left: `calc(50% + ${(i - (arr.length - 1) / 2) * 14}px - 20px)`,
              transform: `rotate(${(i - (arr.length - 1) / 2) * 3}deg)`,
              zIndex: i,
            }}
          />
        ))}
        {aiHand.length > 7 && (
          <span
            className="absolute text-[10px] text-white/60 font-bold"
            style={{ zIndex: 10, bottom: 2, right: 'calc(50% - 40px)' }}
          >
            +{aiHand.length - 7}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center gap-6 py-2">
        <button
          onClick={handleDraw}
          disabled={!isPlayerTurn || phase !== 'playing' || aiThinking || hasPlayableCard}
          className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-lg flex flex-col items-center justify-center text-white font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #2d1b69, #1a1a2e)', border: '2px solid #6366f1' }}
        >
          <span className="text-xs opacity-70">DRAW</span>
          <span className="text-sm font-bold">{deck.length}</span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <div
            className="w-20 h-28 sm:w-24 sm:h-32 rounded-xl shadow-xl flex flex-col items-center justify-center text-white font-bold border-4 relative"
            style={{
              background: COLOR_HEX[currentColor],
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <span className="text-2xl sm:text-3xl drop-shadow-lg">
              {topCard && (topCard.type === 'wild' ? '🌟' : topCard.type === 'wild4' ? '🌟+4' : SYMBOL_DISPLAY[topCard.symbol])}
            </span>
            {topCard && topCard.type !== 'wild' && topCard.type !== 'wild4' && (
              <span className="text-[10px] opacity-80 mt-1">{topCard.color.toUpperCase()}</span>
            )}
          </div>
          <div
            className="w-8 h-8 rounded-full border-2 border-white/30 shadow-md"
            style={{ background: COLOR_HEX[currentColor] }}
          />
        </div>
      </div>

      <div className="text-center text-xs py-1 min-h-[20px]">
        <span className={isAdverseMessage ? 'text-danger' : 'text-text-muted'}>
          {message}
        </span>
      </div>

      {phase === 'choosing-color' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3">
            <span className="text-sm font-bold text-text">Choose a color</span>
            <div className="grid grid-cols-2 gap-2">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => handleChooseColor(color)}
                  className="w-16 h-16 rounded-xl font-bold text-white text-sm shadow-lg transition-all hover:scale-110 active:scale-95"
                  style={{ background: COLOR_HEX[color] }}
                >
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UNO! alert when player has 1 card */}
      {playerHand.length === 1 && phase === 'playing' && (
        <div className="flex-shrink-0 text-center">
          <span className="inline-block bg-yellow-400 text-black font-black text-xl px-4 py-1 rounded-full shadow-lg animate-bounce tracking-widest">
            UNO!
          </span>
        </div>
      )}

      <div className="w-full flex flex-col items-center gap-1 flex-shrink-0">
        <span className="text-[10px] text-text-muted">
          Your hand · {playerHand.length} card{playerHand.length !== 1 ? 's' : ''}
        </span>
        <div className="w-full flex justify-center items-end gap-0.5 px-1 overflow-x-auto max-h-32 pb-1">
          {playerHand.map(card => {
            const playable = isPlayerTurn && phase === 'playing' && canPlay(card, topCard, currentColor);
            const isHighlighted = highlightCard === card.id;
            const isWild = card.type === 'wild' || card.type === 'wild4';

            return (
              <button
                key={card.id}
                onClick={() => handlePlayCard(card)}
                disabled={!playable || aiThinking}
                className="flex-shrink-0 w-11 rounded-lg shadow-md flex flex-col items-center justify-center text-white font-bold transition-all border-2 relative"
                style={{
                  height: 64,
                  background: isWild
                    ? 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)'
                    : COLOR_HEX[card.color],
                  borderColor: playable ? '#fff' : 'rgba(255,255,255,0.15)',
                  opacity: playable ? 1 : 0.55,
                  transform: isHighlighted ? 'scale(1.12)' : playable ? 'translateY(-6px)' : 'none',
                  cursor: playable ? 'pointer' : 'not-allowed',
                  boxShadow: playable ? '0 0 8px rgba(255,255,255,0.35)' : undefined,
                }}
              >
                <span className="text-base drop-shadow-md leading-none">
                  {isWild ? (card.type === 'wild4' ? '+4' : '🌟') : SYMBOL_DISPLAY[card.symbol]}
                </span>
                {!isWild && card.type === 'action' && (
                  <span className="text-[7px] opacity-80 mt-0.5">
                    {card.color.slice(0, 3).toUpperCase()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!hasPlayableCard && isPlayerTurn && phase === 'playing' && !aiThinking && (
        <button
          onClick={handleDraw}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-accent text-bg font-bold px-4 py-2 rounded-xl text-sm shadow-lg animate-pulse z-40"
        >
          Draw a card
        </button>
      )}

      {phase === 'round-over' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs">
            <span className="text-2xl">
              {message.includes('You won') ? '🎉' : '😔'}
            </span>
            <span className="text-sm font-bold text-text text-center">{message}</span>
            <button
              onClick={startNewRound}
              className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all"
            >
              Next Round
            </button>
          </div>
        </div>
      )}

      {phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs">
            <span className="text-3xl">{roundWins >= targetWins ? '🏆' : '😔'}</span>
            <span className="text-lg font-bold text-accent">
              {roundWins >= targetWins ? `You won ${roundWins} rounds!` : `AI won the match`}
            </span>
            <span className="text-sm text-text-muted text-center">
              {roundWins} wins · {losses} losses
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default UnoGame;

