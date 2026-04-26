'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Btn } from '@/components/ui/btn';
import {
  useCommunity, useJoinCommunity, useLeaveCommunity, useDeleteCommunity,
  useCommunityMembers, useKickMember, useUpdateMemberRole,
  isAdminRole, type MemberResponse,
} from '@/lib/hooks/useCommunities';
import { useMessages } from '@/lib/hooks/useMessages';
import { useMe } from '@/lib/hooks/useAuth';

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateSeparatorLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function msgDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ── Members panel ─────────────────────────────────────────────────────────────
function MembersPanel({
  communityId,
  myUserId,
  myRole,
  onClose,
  onLeave,
}: {
  communityId: string;
  myUserId: string;
  myRole: string | null;
  onClose: () => void;
  onLeave: () => void;
}) {
  const { data: members, isLoading } = useCommunityMembers(communityId, true);
  const kickMember = useKickMember(communityId);
  const updateRole = useUpdateMemberRole(communityId);
  const amAdmin = isAdminRole(myRole as never);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, height: '100%',
          background: 'var(--background)', borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Members</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {isLoading && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
          )}
          {!isLoading && (members ?? []).map(member => (
            <MemberRow
              key={member.user_id}
              member={member}
              isMe={member.user_id === myUserId}
              amAdmin={amAdmin}
              onKick={() => kickMember.mutate(member.user_id)}
              onRoleChange={(role) => updateRole.mutate({ userId: member.user_id, role })}
              kicking={kickMember.isPending}
              updating={updateRole.isPending}
            />
          ))}
        </div>

        {/* Footer: Leave */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={onLeave}
            style={{
              width: '100%', padding: '10px', borderRadius: 8,
              background: 'rgba(192,57,43,.08)', border: '1px solid rgba(192,57,43,.3)',
              color: '#C0392B', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Leave community
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  member, isMe, amAdmin, onKick, onRoleChange, kicking, updating,
}: {
  member: MemberResponse;
  isMe: boolean;
  amAdmin: boolean;
  onKick: () => void;
  onRoleChange: (role: 'admin' | 'member') => void;
  kicking: boolean;
  updating: boolean;
}) {
  const isAdmin = member.role === 'admin' || member.role === 'owner';
  const displayName = member.name || member.username;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
      <Avatar name={member.username} src={member.avatar_url ?? undefined} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}{isMe && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (you)</span>}
        </div>
        <div style={{ fontSize: 11, color: isAdmin ? 'var(--accent)' : 'var(--muted)', fontWeight: isAdmin ? 600 : 400, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {member.role}
        </div>
      </div>
      {amAdmin && !isMe && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!isAdmin ? (
            <>
              <button
                onClick={() => onRoleChange('admin')}
                disabled={updating}
                title="Make admin"
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + Admin
              </button>
              <button
                onClick={onKick}
                disabled={kicking}
                title="Kick"
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid rgba(192,57,43,.4)', color: '#C0392B', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Kick
              </button>
            </>
          ) : (
            <button
              onClick={() => onRoleChange('member')}
              disabled={updating}
              title="Remove admin"
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Demote
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Leave guard dialog ────────────────────────────────────────────────────────
function LeaveDialog({
  isSoleAdmin,
  isLeavePending,
  isDeletePending,
  onConfirm,
  onCancel,
  onAssignAdmin,
  onDelete,
}: {
  isSoleAdmin: boolean;
  isLeavePending: boolean;
  isDeletePending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onAssignAdmin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', maxWidth: 340, width: '100%' }}
      >
        {isSoleAdmin ? (
          <>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>You're the only admin</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              Assign another member as admin before leaving, or delete this community.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={onAssignAdmin}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Assign an admin
              </button>
              <button
                onClick={onDelete}
                disabled={isDeletePending}
                style={{ padding: '10px', borderRadius: 8, border: 'none', background: '#C0392B', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {isDeletePending ? 'Deleting…' : 'Delete community'}
              </button>
              <button
                onClick={onCancel}
                style={{ padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Leave community?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              You will lose access to this community's chat.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onCancel}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLeavePending}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#C0392B', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {isLeavePending ? 'Leaving…' : 'Leave'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommunityPage() {
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isSoleAdmin, setIsSoleAdmin] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const { data: me } = useMe();
  const { data: community, refetch: refetchCommunity } = useCommunity(id);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const deleteCommunity = useDeleteCommunity();

  const isMember = community?.user_role !== null && community?.user_role !== undefined;
  const amAdmin = isAdminRole(community?.user_role ?? null);

  const { messages, isLoading, isLoadingMore, hasMore, loadMore, sendMessage, sendTyping, typingUser } =
    useMessages(isMember ? id : '');

  useEffect(() => {
    if (!isLoading && bottomRef.current && isAtBottomRef.current) {
      bottomRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoadingMore && scrollRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += newScrollHeight - prevScrollHeightRef.current;
    }
  }, [isLoadingMore]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 80 && hasMore && !isLoadingMore) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const send = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
    isAtBottomRef.current = true;
    setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 50);
  };

  const handleLeave = () => {
    setIsSoleAdmin(false);
    leave.mutate(id, {
      onSuccess: () => router.push('/communities'),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
        if (msg.toLowerCase().includes('only admin')) {
          setIsSoleAdmin(true);
        }
      },
    });
  };

  const handleDeleteCommunity = () => {
    deleteCommunity.mutate(id, {
      onSuccess: () => router.push('/communities'),
    });
  };

  const myUserId = me?.id ?? '';
  const myUsername = me?.profile?.username;

  // ── Join gate ────────────────────────────────────────────────────────────
  if (community && !isMember) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => router.push('/communities')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{community.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{community.member_count} members</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16, lineHeight: 1 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>Members only</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 260 }}>
            Join <strong style={{ color: 'var(--foreground)' }}>{community.name}</strong> to read and send messages.
          </p>
          <Btn onClick={() => join.mutate(id, { onSuccess: () => refetchCommunity() })} disabled={join.isPending}>
            {join.isPending ? 'Joining…' : 'Join community'}
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--background)', flexShrink: 0, position: 'relative' }}>
        <button onClick={() => router.push('/communities')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 0, display: 'flex', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{community?.name ?? '…'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{community ? `${community.member_count} members` : ''}</div>
        </div>

        {/* ⋯ menu trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: '4px 8px', lineHeight: 1, borderRadius: 6 }}
          >
            ⋯
          </button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 30, marginTop: 4,
                background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden',
              }}>
                {amAdmin && (
                  <button
                    onClick={() => { setShowMenu(false); setShowMembers(true); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit' }}
                  >
                    Members
                  </button>
                )}
                <button
                  onClick={() => { setShowMenu(false); setShowLeaveDialog(true); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#C0392B', fontFamily: 'inherit' }}
                >
                  Leave community
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {isLoadingMore && (
          <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--muted)', fontSize: 12 }}>Loading older messages…</div>
        )}
        {isLoading && (
          <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', margin: 'auto' }}>Loading…</div>
        )}
        {!isLoading && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 14, lineHeight: 1 }}>💬</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>No messages yet</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 240 }}>
              Be the first to start the conversation in <strong style={{ color: 'var(--foreground)' }}>{community?.name}</strong>.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const mine = myUsername ? msg.sender.username === myUsername : false;
          const showDateSep = i === 0 || msgDay(messages[i - 1].created_at) !== msgDay(msg.created_at);
          const showHeader = !mine && !msg.is_system && (i === 0 || messages[i - 1].sender.username !== msg.sender.username || showDateSep);

          // System message (e.g. "X left the community")
          if (msg.is_system) {
            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', padding: '2px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999 }}>
                      {dateSeparatorLabel(msg.created_at)}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>{msg.content}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', padding: '2px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999 }}>
                    {dateSeparatorLabel(msg.created_at)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 }}>
                {!mine && showHeader && <Avatar name={msg.sender.username} src={msg.sender.avatar_url ?? undefined} size={28} />}
                {!mine && !showHeader && <div style={{ width: 28, flexShrink: 0 }} />}
                <div style={{ maxWidth: '72%' }}>
                  {showHeader && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, paddingLeft: 2 }}>
                      {msg.sender.username}
                    </div>
                  )}
                  <div style={{
                    padding: '9px 13px',
                    borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: mine ? 'var(--accent)' : 'var(--card)',
                    border: mine ? 'none' : '1px solid var(--border)',
                    color: mine ? '#fff' : 'var(--foreground)',
                    fontSize: 14, lineHeight: 1.5,
                  }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, textAlign: mine ? 'right' : 'left', paddingLeft: mine ? 0 : 2 }}>
                    {formatMessageTime(msg.created_at)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typingUser && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', paddingLeft: 38, marginTop: 4 }}>
            {typingUser} is typing…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--background)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); sendTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message…"
            rows={1}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5 }}
          />
        </div>
        <button
          onClick={send}
          style={{ width: 38, height: 38, borderRadius: '50%', background: input.trim() ? 'var(--accent)' : 'var(--border)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0, transition: 'background .15s' }}
        >↑</button>
      </div>

      {/* Members panel */}
      {showMembers && (
        <MembersPanel
          communityId={id}
          myUserId={myUserId}
          myRole={community?.user_role ?? null}
          onClose={() => setShowMembers(false)}
          onLeave={() => { setShowMembers(false); setShowLeaveDialog(true); }}
        />
      )}

      {/* Leave dialog */}
      {showLeaveDialog && (
        <LeaveDialog
          isSoleAdmin={isSoleAdmin}
          isLeavePending={leave.isPending}
          isDeletePending={deleteCommunity.isPending}
          onConfirm={handleLeave}
          onCancel={() => { setShowLeaveDialog(false); setIsSoleAdmin(false); }}
          onAssignAdmin={() => { setShowLeaveDialog(false); setIsSoleAdmin(false); setShowMembers(true); }}
          onDelete={handleDeleteCommunity}
        />
      )}
    </div>
  );
}
