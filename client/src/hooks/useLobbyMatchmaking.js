import { useState, useEffect, useRef } from 'react';
import {
  formatRoomCodeInput,
  isValidRoomCode,
  generateRoomCode,
  getPlayerId,
  getActiveSession,
  clearActiveSession
} from '../services/roomCode.js';
import { triggerHaptic } from '../services/haptics.js';

const loadMultiplayer = () => import('../services/multiplayer.js');

export function useLobbyMatchmaking({
  showMultiplayer,
  showFactionSelection,
  setShowFactionSelection,
  setShowMultiplayer,
  setShowModes,
  navigateTo
}) {
  const [roomCode, setRoomCode] = useState('');
  const [currentMode, setCurrentMode] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [currentRoomData, setCurrentRoomData] = useState(null);
  const [mySelectedFaction, setMySelectedFaction] = useState(null);
  const [playersList, setPlayersList] = useState([]);

  // Multiplayer Hub State
  const [mpPanel, setMpPanel] = useState(null); // null | 'host' | 'join'
  const [openRooms, setOpenRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isHosting, setIsHosting] = useState(false);
  const [hostIsPublic, setHostIsPublic] = useState(true);
  const [hostAutoCode, setHostAutoCode] = useState('');
  const [hostCustomCode, setHostCustomCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [disbandCountdown, setDisbandCountdown] = useState(180);
  const [recoverableSession, setRecoverableSession] = useState(null);

  const roomUnsubRef = useRef(null);
  const openRoomsUnsubRef = useRef(null);
  const playersListRef = useRef([]);
  const mySelectedFactionRef = useRef(null);

  // Active Battle Recovery Detection
  useEffect(() => {
    const session = getActiveSession();
    if (!session || !session.roomId) return;

    loadMultiplayer().then(async ({ checkRoomStatus }) => {
      const pId = getPlayerId();
      const status = await checkRoomStatus(session.roomId, pId);
      if (status.exists && status.active) {
        setRecoverableSession({
          roomId: session.roomId,
          team: status.myTeam || session.team || 'snow'
        });
      } else {
        clearActiveSession();
      }
    }).catch(() => { });
  }, []);

  const handleResumeSession = () => {
    if (!recoverableSession) return;
    triggerHaptic('medium');
    navigateTo('GAME', { room: recoverableSession.roomId, team: recoverableSession.team });
  };

  const handleAbandonSession = async () => {
    if (!recoverableSession) return;
    triggerHaptic('light');
    const targetRoom = recoverableSession.roomId;
    clearActiveSession();
    setRecoverableSession(null);
    try {
      const { leaveRoom } = await loadMultiplayer();
      await leaveRoom(targetRoom, getPlayerId());
    } catch (_) { }
  };

  // Unmount cleanup
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
      if (roomUnsubRef.current) {
        roomUnsubRef.current();
        roomUnsubRef.current = null;
      }
      if (openRoomsUnsubRef.current) {
        openRoomsUnsubRef.current();
        openRoomsUnsubRef.current = null;
      }
    };
  }, []);

  // Listen to live open rooms when multiplayer hub is open
  useEffect(() => {
    if (!showMultiplayer) {
      if (openRoomsUnsubRef.current) {
        openRoomsUnsubRef.current();
        openRoomsUnsubRef.current = null;
      }
      return;
    }

    setIsLoadingRooms(true);
    let isCurrent = true;

    loadMultiplayer().then(({ subscribeToOpenRooms, generateRoomCode }) => {
      if (!isCurrent) return;
      setHostAutoCode(generateRoomCode());

      openRoomsUnsubRef.current = subscribeToOpenRooms((rooms) => {
        if (isCurrent) {
          setOpenRooms(rooms);
          setIsLoadingRooms(false);
        }
      }, (err) => {
        console.warn('Open rooms subscription error:', err);
        if (isCurrent) setIsLoadingRooms(false);
      });
    });

    return () => {
      isCurrent = false;
      if (openRoomsUnsubRef.current) {
        openRoomsUnsubRef.current();
        openRoomsUnsubRef.current = null;
      }
    };
  }, [showMultiplayer]);

  const attachRoomSubscription = (code, playerId) => {
    if (roomUnsubRef.current) {
      roomUnsubRef.current();
      roomUnsubRef.current = null;
    }

    loadMultiplayer().then(({ subscribeToRoom }) => {
      roomUnsubRef.current = subscribeToRoom(code, (roomData) => {
        if (!roomData) return;

        // Disbanded room handler
        if (roomData.status === 'DISBANDED') {
          if (roomUnsubRef.current) {
            roomUnsubRef.current();
            roomUnsubRef.current = null;
          }
          const reasonText = roomData.disbandReason === 'HOST_LEFT'
            ? 'The host has left the realm. The battle has been disbanded.'
            : 'This realm was disbanded due to inactivity.';
          alert(reasonText);
          setShowFactionSelection(false);
          setMySelectedFaction(null);
          setCurrentRoomId(null);
          setCurrentRoomData(null);
          setShowModes(true);
          return;
        }

        setCurrentRoomData(roomData);
        const players = roomData.players || [];
        playersListRef.current = players;
        setPlayersList(players);

        const me = players.find(p => p.id === playerId);
        if (me && me.team) {
          mySelectedFactionRef.current = me.team;
          setMySelectedFaction(me.team);
        } else {
          mySelectedFactionRef.current = null;
          setMySelectedFaction(null);
        }

        if (roomData.gameState?.gameStarted) {
          const assignedTeam = me?.team || mySelectedFactionRef.current || 'snow';
          if (roomUnsubRef.current) {
            roomUnsubRef.current();
            roomUnsubRef.current = null;
          }
          navigateTo('GAME', { room: code, team: assignedTeam });
        }
      }, (err) => {
        console.error('Room subscription error:', err);
      });
    });
  };

  const handleJoinSpecificRoom = async (rawCode) => {
    const code = (rawCode || '').trim().toUpperCase();
    if (!isValidRoomCode(code)) {
      alert('Please enter a valid realm code (e.g. FROST-402).');
      return;
    }

    try {
      const { joinOrCreateRoom, getOrCreatePlayerId } = await loadMultiplayer();
      const playerId = getOrCreatePlayerId();
      setCurrentRoomId(code);

      const res = await joinOrCreateRoom(code, playerId);
      if (!res.success) {
        setCurrentRoomId(null);
        alert(res.error || 'Failed to enter realm.');
        return;
      }

      setCurrentRoomData(res.room);

      // Reconnecting to active game
      if (res.room.gameState?.gameStarted && res.team) {
        navigateTo('GAME', { room: code, team: res.team });
        return;
      }

      setPlayersList(res.room.players || []);
      playersListRef.current = res.room.players || [];

      attachRoomSubscription(code, playerId);

      setShowModes(false);
      setShowMultiplayer(false);
      setShowFactionSelection(true);
    } catch (err) {
      console.error('Join room error:', err);
      alert('Failed to connect to the realm.');
      setCurrentRoomId(null);
    }
  };

  // Direct join from URL invite (?room=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const roomFromUrl = p.get('room');
    if (roomFromUrl && !p.get('team')) {
      setCurrentMode('online');
      handleJoinSpecificRoom(roomFromUrl);
    }
  }, []);

  // Heartbeat & Lobby Inactivity Timer in Faction Selection
  useEffect(() => {
    if (!showFactionSelection || !currentRoomId) return;

    const playerId = getPlayerId();
    loadMultiplayer().then(({ updatePlayerHeartbeat }) => {
      updatePlayerHeartbeat(currentRoomId, playerId);
    });

    const heartbeatInterval = setInterval(() => {
      loadMultiplayer().then(({ updatePlayerHeartbeat }) => {
        updatePlayerHeartbeat(currentRoomId, playerId);
      });
    }, 15000);

    setDisbandCountdown(180);
    const countdownInterval = setInterval(() => {
      setDisbandCountdown((prev) => {
        if (playersListRef.current.length >= 2) return 180;
        if (prev <= 1) {
          loadMultiplayer().then(({ disbandRoom }) => {
            disbandRoom(currentRoomId, 'WAIT_TIMEOUT');
          });
          if (roomUnsubRef.current) {
            roomUnsubRef.current();
            roomUnsubRef.current = null;
          }
          alert('Realm was disbanded due to inactivity (no opponent joined within 3 minutes).');
          setShowFactionSelection(false);
          setMySelectedFaction(null);
          setCurrentRoomId(null);
          setCurrentRoomData(null);
          setShowModes(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(countdownInterval);
    };
  }, [showFactionSelection, currentRoomId]);

  const handleQuickMatch = async () => {
    triggerHaptic('medium');
    setIsMatching(true);

    try {
      const { quickMatch, findQuickMatch, getOrCreatePlayerId } = await loadMultiplayer();
      const playerId = getOrCreatePlayerId();
      const matchFn = quickMatch || findQuickMatch;
      const result = await matchFn(playerId);

      if (result.success) {
        setIsMatching(false);
        setCurrentRoomId(result.roomId);
        setCurrentRoomData(result.room);
        setPlayersList(result.room.players || []);
        playersListRef.current = result.room.players || [];

        attachRoomSubscription(result.roomId, playerId);

        setShowModes(false);
        setShowMultiplayer(false);
        setShowFactionSelection(true);
      } else {
        alert('Matchmaking failed. Please try again.');
        setIsMatching(false);
      }
    } catch (err) {
      console.error('QuickMatch Error:', err);
      alert('Error finding a match.');
      setIsMatching(false);
    }
  };

  const handleHostRealm = async () => {
    triggerHaptic('medium');
    let codeToUse = hostIsPublic ? hostAutoCode : (hostCustomCode || '').trim().toUpperCase();

    if (!hostIsPublic) {
      if (!isValidRoomCode(codeToUse)) {
        alert('Invalid Custom Code. Must follow format (e.g. FROST-402).');
        return;
      }
    }

    setIsHosting(true);
    try {
      const { createRoom, createCustomRoom, getOrCreatePlayerId } = await loadMultiplayer();
      const playerId = getOrCreatePlayerId();
      const makeRoom = createRoom 
        ? (pId, opts) => createRoom(pId, opts)
        : (pId, opts) => createCustomRoom(opts.customCode, opts.isPublic, pId);
      const res = await makeRoom(playerId, {
        isPublic: hostIsPublic,
        customCode: codeToUse
      });

      if (res.success) {
        setCurrentRoomId(codeToUse);
        setCurrentRoomData(res.room);
        setPlayersList(res.room.players || []);
        playersListRef.current = res.room.players || [];

        attachRoomSubscription(codeToUse, playerId);

        setShowModes(false);
        setShowMultiplayer(false);
        setShowFactionSelection(true);
      } else {
        alert(res.error || 'Failed to create realm.');
      }
    } catch (e) {
      alert('Could not establish realm. Please check connectivity.');
    } finally {
      setIsHosting(false);
    }
  };

  const handleRerollCode = () => {
    triggerHaptic('light');
    setHostAutoCode(generateRoomCode());
  };

  const handleRoomCodeChange = (e) => {
    setRoomCode(formatRoomCodeInput(e.target.value, roomCode));
  };

  const handlePasteCode = async () => {
    triggerHaptic('light');
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const formatted = formatRoomCodeInput(text, roomCode);
          setRoomCode(formatted);
        }
      }
    } catch (_) { }
  };

  const handleCopyInviteLink = (code) => {
    triggerHaptic('light');
    const target = code || currentRoomId;
    if (!target) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(target)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      }).catch(() => {
        prompt('Copy invite link:', url);
      });
    } else {
      prompt('Copy invite link:', url);
    }
  };

  const handleSelectFaction = async (faction) => {
    triggerHaptic('select');

    if (currentMode === 'ai') {
      navigateTo('GAME', { mode: 'local', ai: '1', team: faction });
    } else if (currentMode === 'online') {
      mySelectedFactionRef.current = faction;
      setMySelectedFaction(faction);
      try {
        const { selectFaction, getOrCreatePlayerId } = await loadMultiplayer();
        await selectFaction(currentRoomId, getOrCreatePlayerId(), faction);
      } catch (err) {
        alert(err.message || 'Failed to claim faction.');
        mySelectedFactionRef.current = null;
        setMySelectedFaction(null);
      }
    }
  };

  const handleCancelFaction = async () => {
    if (roomUnsubRef.current) {
      roomUnsubRef.current();
      roomUnsubRef.current = null;
    }
    if (currentRoomId) {
      try {
        const { leaveRoom, getOrCreatePlayerId } = await loadMultiplayer();
        await leaveRoom(currentRoomId, getOrCreatePlayerId());
      } catch (e) { }
    }
    setShowFactionSelection(false);
    setMySelectedFaction(null);
    setCurrentRoomId(null);
    setCurrentRoomData(null);
    setPlayersList([]);
    playersListRef.current = [];
    if (currentMode === 'online') { setShowMultiplayer(true); setMpPanel(null); }
    else setShowModes(true);
  };

  const getFactionBtnState = (faction) => {
    const pId = getPlayerId();
    const myPlayer = playersList.find(p => p.id === pId);
    const otherPlayer = playersList.find(p => p.id !== pId);

    const isMySelection = myPlayer?.team === faction || mySelectedFaction === faction;
    const isOtherSelection = otherPlayer?.team === faction;

    if (isMySelection) return { label: 'FACTION SELECTED', disabled: true, status: 'mine' };
    if (isOtherSelection) return { label: 'OCCUPIED BY ENEMY', disabled: true, status: 'occupied' };
    if (mySelectedFaction && mySelectedFaction !== faction) return { label: 'LOCKED', disabled: true, status: 'locked' };
    return { label: 'SELECT FACTION', disabled: false, status: 'available' };
  };

  const snowBtnState = getFactionBtnState('snow');
  const ashBtnState = getFactionBtnState('ash');

  return {
    roomCode,
    setRoomCode,
    currentMode,
    setCurrentMode,
    currentRoomId,
    currentRoomData,
    mySelectedFaction,
    playersList,
    mpPanel,
    setMpPanel,
    openRooms,
    isLoadingRooms,
    isMatching,
    isHosting,
    hostIsPublic,
    setHostIsPublic,
    hostAutoCode,
    hostCustomCode,
    setHostCustomCode,
    copiedLink,
    disbandCountdown,
    recoverableSession,
    handleResumeSession,
    handleAbandonSession,
    handleJoinSpecificRoom,
    handleQuickMatch,
    handleHostRealm,
    handleRerollCode,
    handleRoomCodeChange,
    handlePasteCode,
    handleCopyInviteLink,
    handleSelectFaction,
    handleCancelFaction,
    snowBtnState,
    ashBtnState
  };
}
