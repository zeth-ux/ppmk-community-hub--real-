"""Permission tests for supabase/migrations/0001_init.sql against a local
Postgres that imitates Supabase (auth.users, auth.uid(), anon/authenticated)."""
import glob, os, subprocess, sys, uuid
import psycopg2

DSN = dict(host=os.environ.get("PGHOST", "/home/claude/pgtest"), port=int(os.environ.get("PGPORT", 5499)), user="postgres")
MIGRATIONS = sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "migrations", "*.sql")))
# MODE=new  -> Supabase 2026 behaviour: no automatic table grants
# MODE=old  -> older projects: automatic grants to anon/authenticated
MODE = os.environ.get("MODE", "new")

subprocess.run(["psql", "-h", DSN["host"], "-p", str(DSN["port"]), "-U", "postgres", "-qc", "drop database if exists hub"], check=True)
subprocess.run(["psql", "-h", DSN["host"], "-p", str(DSN["port"]), "-U", "postgres", "-qc", "create database hub"], check=True)
mock = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_supabase.sql")
extra = [] if MODE == "new" else [os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_old_default_grants.sql")]
for f in [mock, *extra, *MIGRATIONS]:
    r = subprocess.run(["psql", "-h", DSN["host"], "-p", str(DSN["port"]), "-U", "postgres", "-d", "hub", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], capture_output=True, text=True)
    if r.returncode:
        print(r.stderr); sys.exit("migration failed")
print(f"migrations applied cleanly (mode={MODE}): {[os.path.basename(m) for m in MIGRATIONS]}")

conn = psycopg2.connect(dbname="hub", **DSN)
conn.autocommit = True
fails = 0

def run(sql, uid=None, role="authenticated", args=None):
    """Run sql as a given user. Returns rows, or 'ERR: ...'."""
    cur = conn.cursor()
    try:
        cur.execute("begin")
        if role:
            cur.execute(f"set local role {role}")
        cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (str(uid) if uid else "",))
        cur.execute(sql, args)
        rows = cur.fetchall() if cur.description else cur.rowcount
        cur.execute("commit")
        return rows
    except Exception as e:
        cur.execute("rollback")
        return "ERR: " + str(e).splitlines()[0]

def check(name, cond, got=None):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> got {got!r}"))
    fails += 0 if cond else 1

def is_err(r, text=""):
    return isinstance(r, str) and r.startswith("ERR") and text in r

def new_user(email):
    return run("insert into auth.users (email) values (%s) returning id", role=None, args=(email,))[0][0]

def complete(uid, sid, batch):
    return run("""update profiles set student_id=%s, full_name=%s, batch=%s, age=21,
                  phone='010-1234-5678', course='Computer Science', residence='Ansan', consent_at=now()
                  where id=auth.uid()""", uid, args=(sid, "Student " + sid, batch))

A  = new_user("admin@x.com")
O  = new_user("org@x.com")
S1 = new_user("s1@x.com")
S2 = new_user("s2@x.com")
S3 = new_user("s3@x.com")
run("update profiles set role='admin' where id=%s", role=None, args=(A,))  # bootstrap, like the SQL editor

check("signup trigger created 5 profiles", run("select count(*) from profiles", role=None)[0][0] == 5)
check("S1 completes own profile", complete(S1, "2024001", 2024) == 1)
r = run("update profiles set phone='010-9999-0000' where id=auth.uid() returning id, full_name, role", S1)
check("profile update with RETURNING works (what the app sends)", r == [(S1, "Student 2024001", "student")], r)
check("S2 completes own profile", complete(S2, "2025001", 2025) == 1)
complete(A, "2023001", 2023); complete(O, "2023002", 2023)

r = run("update profiles set role='admin' where id=auth.uid()", S1)
check("student cannot make themselves admin", is_err(r, "permission denied"), r)
r = run("update profiles set full_name='Hacked' where id=%s", S1, args=(S2,))
check("student cannot edit someone else's profile", r == 0, r)
r = run("select id from profiles", S1)
check("student sees only own profile", r == [(S1,)], r)
r = run("select count(*) from profiles", A)
check("admin sees all profiles", r == [(5,)], r)
r = run("update profiles set student_id='2024001' where id=auth.uid()", S2)
check("duplicate student ID rejected", is_err(r, "duplicate"), r)

r = run("select set_user_role(%s, 'organizer')", S1, args=(O,))
check("student cannot promote anyone", is_err(r, "NOT_ALLOWED"), r)
r = run("select set_user_role(%s, 'organizer')", A, args=(O,))
check("admin promotes organizer", not is_err(r), r)
r = run("select set_user_role(%s, 'student')", A, args=(A,))
check("last admin cannot demote themselves", is_err(r, "LAST_ADMIN"), r)

ins = """insert into events (title, category, event_date, start_time, location, capacity, rsvp_deadline, audience, audience_batches)
         values (%s, 'Sports', %s, '15:00', 'Field', %s, %s, %s, %s) returning id"""
r = run(ins, S1, args=("Hack", "2099-01-01", None, None, "everyone", []))
check("student cannot create events", is_err(r), r)
E1 = run(ins, O, args=("Everyone cap1", "2099-01-01", 1, None, "everyone", []))[0][0]
E2 = run(ins, O, args=("Batch 2025 only", "2099-01-01", None, None, "batch", [2025]))[0][0]
E3 = run(ins, O, args=("Custom invite", "2099-01-01", None, None, "custom", []))[0][0]
E4 = run(ins, O, args=("Deadline passed", "2099-01-01", None, "2020-01-01", "everyone", []))[0][0]
check("organizer creates 4 events", all([E1, E2, E3, E4]))

r = run("select set_event_invites(%s, %s::uuid[])", O, args=(E3, [str(S1)]))
check("organizer invites S1 to custom event", r == [(1,)], r)

s1_titles = {t for (t,) in run("select title from events", S1)}
s2_titles = {t for (t,) in run("select title from events", S2)}
check("S1 (batch 2024, invited) sees right events", s1_titles == {"Everyone cap1", "Custom invite", "Deadline passed"}, s1_titles)
check("S2 (batch 2025) sees right events", s2_titles == {"Everyone cap1", "Batch 2025 only", "Deadline passed"}, s2_titles)

r = run("select status from set_my_rsvp(%s, 'attending', 'see you')", S1, args=(E1,))
check("S1 RSVPs attending (one tap)", r == [("attending",)], r)
r = run("select status from set_my_rsvp(%s, 'attending')", S2, args=(E1,))
check("capacity enforced: S2 cannot take a full event", is_err(r, "EVENT_FULL"), r)
r = run("select status from set_my_rsvp(%s, 'maybe')", S2, args=(E1,))
check("S2 can still say maybe", r == [("maybe",)], r)
r = run("select status from set_my_rsvp(%s, 'not_attending')", S1, args=(E1,))
check("S1 changes RSVP (update path)", r == [("not_attending",)], r)
r = run("select status from set_my_rsvp(%s, 'attending')", S2, args=(E1,))
check("seat freed -> S2 can now attend", r == [("attending",)], r)
r = run("select status from set_my_rsvp(%s, 'maybe')", S3, args=(E1,))
check("incomplete profile cannot RSVP", is_err(r, "row-level security"), r)
r = run("select status from set_my_rsvp(%s, 'attending')", S1, args=(E2,))
check("cannot RSVP to an event not meant for you", is_err(r, "row-level security"), r)
r = run("select status from set_my_rsvp(%s, 'attending')", S1, args=(E4,))
check("cannot RSVP after the deadline", is_err(r, "row-level security"), r)
r = run("insert into rsvps (event_id, user_id, status) values (%s, %s, 'attending')", S1, args=(E3, S2))
check("cannot RSVP on someone else's behalf", is_err(r), r)

r = run("update rsvps set checked_in_at=now() where user_id=auth.uid()", S2)
check("student cannot check themselves in", is_err(r, "permission denied"), r)
r = run("select check_in(%s, %s)", O, args=(E1, S2))
check("organizer checks S2 in", not is_err(r) and r[0][0] is not None, r)

r = run("select user_id from rsvps", S1)
check("student sees only own RSVPs", {u for (u,) in r} == {S1}, r)
r = run("select attending, maybe, not_attending from event_rsvp_counts() where event_id=%s", S1, args=(E1,))
check("student sees counts only", r == [(1, 0, 1)], r)
r = run("select * from event_attendees(%s)", S1, args=(E1,))
check("student cannot read attendee list", is_err(r, "NOT_ALLOWED"), r)
r = run("select full_name, phone, status from event_attendees(%s)", O, args=(E1,))
check("organizer reads attendee list incl. phone", len(r) == 2 and all(p for (_, p, _) in r), r)
r = run("select * from list_members()", S1)
check("student cannot list members", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from hub_stats()", O)
check("organizer cannot read admin stats", is_err(r, "NOT_ALLOWED"), r)
r = run("select members, rsvps, check_ins from hub_stats()", A)
check("admin reads stats", r == [(5, 2, 1)], r)

r = run("select * from events", None, role="anon")
check("signed-out visitor cannot read events", is_err(r, "permission denied"), r)
r = run("select * from profiles", None, role="anon")
check("signed-out visitor cannot read profiles", is_err(r, "permission denied"), r)
r = run("select * from event_rsvp_counts()", None, role="anon")
check("signed-out visitor cannot call functions", is_err(r, "permission denied"), r)

r = run("insert into clubs (name) values ('X')", O)
check("organizer cannot add clubs", is_err(r), r)
r = run("insert into clubs (name) values ('Chess Club') returning name", A)
check("admin adds a club", r == [("Chess Club",)], r)

r = run("select delete_my_account()", S2)
check("S2 deletes their account", not is_err(r), r)
check("S2's profile and RSVPs are gone",
      run("select (select count(*) from profiles where id=%s) + (select count(*) from rsvps where user_id=%s)", role=None, args=(S2, S2)) == [(0,)])
r = run("select delete_my_account()", A)
check("last admin cannot delete themselves", is_err(r, "LAST_ADMIN"), r)


# ---------- AI usage limits (0003) ----------
r = run("select ai_begin('extract')", S1)
check("student cannot use organizer AI", is_err(r, "NOT_ALLOWED"), r)
r = run("select ai_begin('ask')", S3)
check("incomplete profile cannot use the chatbot", is_err(r, "NOT_ALLOWED"), r)
r = run("select ai_begin('ask')", S1)
check("student can use the chatbot (29 left)", r == [(29,)], r)
r = run("select ai_begin('hack')", O)
check("unknown AI kind rejected", is_err(r, "BAD_KIND"), r)
for _ in range(39):
    run("select ai_begin('extract')", O)
r = run("select ai_begin('extract')", O)
check("organizer gets 40 AI fills per day", r == [(0,)], r)
r = run("select ai_begin('extract')", O)
check("41st AI call today is refused", is_err(r, "AI_DAILY_LIMIT"), r)
r = run("select ai_begin('announce')", O)
check("limits are per feature", r == [(39,)], r)
r = run("select * from ai_usage", S1)
check("nobody can read the usage log directly", is_err(r, "permission denied"), r)
r = run("insert into ai_usage (user_id, kind) values (auth.uid(), 'ask')", S1)
check("nobody can write the usage log directly", is_err(r, "permission denied"), r)
r = run("select * from ai_usage_stats()", O)
check("organizer cannot read AI stats", is_err(r, "NOT_ALLOWED"), r)
r = run("select kind, total from ai_usage_stats()", A)
check("admin reads AI stats", ("extract", 40) in r and ("ask", 1) in r, r)
r = run("update events set announcements = '{\"en\": \"Hi\"}'::jsonb where id=%s returning announcements->>'en'", O, args=(E1,))
check("organizer saves an AI announcement", r == [("Hi",)], r)
r = run("select ai_begin('ask')", None, role="anon")
check("signed-out visitor cannot call the AI gate", is_err(r, "permission denied"), r)


# ---------- Usernames, clubs, applications, discussions (0004) ----------
P = new_user("pres@x.com"); M = new_user("member@x.com"); V = new_user("vp@x.com")
complete(P, "2024101", 2024); complete(M, "2024102", 2024); complete(V, "2024103", 2024)
r = run("update profiles set username='Bad Name!' where id=auth.uid()", P)
check("invalid username rejected", is_err(r, "username_format"), r)
check("username saved", run("update profiles set username='pres_amir' where id=auth.uid()", P) == 1)
run("update profiles set username='member_m' where id=auth.uid()", M)
run("update profiles set username='vp_v' where id=auth.uid()", V)
r = run("update profiles set username='pres_amir' where id=auth.uid()", M)
check("duplicate username rejected", is_err(r, "duplicate"), r)
check("username_available says taken", run("select username_available('pres_amir')", M) == [(False,)])
check("username_available says free", run("select username_available('someone_new')", M) == [(True,)])

app = """insert into club_applications (club_name, category, description, documents)
         values ('Hiking Club', 'Sports', 'We hike a mountain near Ansan every month together.', '{"constitution":"https://x"}')
         returning id"""
r = run(app, S3)
check("incomplete profile cannot apply for a club", is_err(r), r)
APP = run(app, P)[0][0]
check("student applies to start a club", APP is not None)
r = run("update club_applications set status='approved' where id=%s", P, args=(APP,))
check("applicant cannot approve own application", is_err(r, "permission denied"), r)
check("other students cannot see the application", run("select count(*) from club_applications", M) == [(0,)])
r = run("select review_club_application(%s, 'approved')", O, args=(APP,))
check("organizer cannot approve clubs", is_err(r, "NOT_ALLOWED"), r)
r = run("select review_club_application(%s, 'needs_changes', 'Add member list')", A, args=(APP,))
check("admin asks for changes", not is_err(r), r)
run("update club_applications set founding_members='a, b, c, d, e' where id=%s", P, args=(APP,))
check("fixing the application sends it back to pending",
      run("select status from club_applications where id=%s", P, args=(APP,)) == [("pending",)])
CLUB = run("select review_club_application(%s, 'approved')", A, args=(APP,))[0][0]
check("admin approves: club created", CLUB is not None)
check("applicant became president", run("select my_club_role(%s)", P, args=(CLUB,)) == [("president",)])
check("applicant became organizer", run("select role from profiles where id=auth.uid()", P) == [("organizer",)])
r = run("select review_club_application(%s, 'rejected')", A, args=(APP,))
check("decided application cannot be decided again", is_err(r, "ALREADY_DECIDED"), r)

r = run("update clubs set tagline='Hike with us' where id=%s", P, args=(CLUB,))
check("president edits own club page", r == 1, r)
r = run("update clubs set tagline='x' where id=%s", M, args=(CLUB,))
check("non-member cannot edit club page", r == 0, r)
r = run("update clubs set status='inactive' where id=%s", P, args=(CLUB,))
check("president cannot change club status", is_err(r, "ONLY_ADMINS"), r)

check("join request is pending (approval policy)", run("select join_club(%s, 'hi!')", M, args=(CLUB,)) == [("pending",)])
run("select join_club(%s)", V, args=(CLUB,))
r = run("select username, status, message from list_club_members(%s)", S1, args=(CLUB,))
check("outsiders see only active members, no pending", r == [("pres_amir", "active", "")], r)
r = run("select username, message from list_club_members(%s) where status='pending' order by 1", P, args=(CLUB,))
check("president sees pending requests with message", r == [("member_m", "hi!"), ("vp_v", "")], r)
r = run("select decide_club_request(%s, %s, true)", M, args=(CLUB, V))
check("member cannot accept requests", is_err(r, "NOT_ALLOWED"), r)
run("select decide_club_request(%s, %s, true)", P, args=(CLUB, M))
run("select decide_club_request(%s, %s, true)", P, args=(CLUB, V))
check("president accepts members", run("select my_club_role(%s)", M, args=(CLUB,)) == [("member",)])
r = run("select set_club_member_role(%s, %s, 'vice_president')", P, args=(CLUB, V))
check("president appoints vice president", not is_err(r), r)
check("vice president became organizer", run("select role from profiles where id=auth.uid()", V) == [("organizer",)])
r = run("select set_club_member_role(%s, %s, 'president')", V, args=(CLUB, M))
check("vice president cannot appoint a president", is_err(r, "ONLY_PRESIDENT"), r)
r = run("select set_club_member_role(%s, %s, 'committee')", V, args=(CLUB, M))
check("vice president can appoint committee", not is_err(r), r)
run("select set_club_member_role(%s, %s, 'member')", P, args=(CLUB, M))
r = run("select leave_club(%s)", P, args=(CLUB,))
check("last president cannot leave", is_err(r, "LAST_PRESIDENT"), r)

post = "insert into club_posts (club_id, kind, title, visibility) values (%s, 'meeting', 'Weekly meeting', %s) returning id"
r = run(post, M, args=(CLUB, "everyone"))
check("ordinary member cannot post (leaders-only setting)", is_err(r), r)
CP1 = run(post, V, args=(CLUB, "everyone"))[0][0]
CP2 = run(post, P, args=(CLUB, "members"))[0][0]
check("leaders post activities", CP1 and CP2)
run("update clubs set who_can_post='members' where id=%s", P, args=(CLUB,))
r = run(post, M, args=(CLUB, "everyone"))
check("member can post once club allows it", not is_err(r), r)
r = run("select count(*) from club_posts where club_id=%s", S1, args=(CLUB,))
check("outsider sees only public posts", r == [(2,)], r)
run("update clubs set posts_visibility='members' where id=%s", P, args=(CLUB,))
r = run("select count(*) from club_posts where club_id=%s", S1, args=(CLUB,))
check("members-only club hides all posts from outsiders", r == [(0,)], r)
check("members still see all posts", run("select count(*) from club_posts where club_id=%s", M, args=(CLUB,)) == [(3,)])
r = run("delete from club_posts where id=%s", M, args=(CP1,))
check("member cannot delete a leader's post", r == 0, r)

fp = "insert into forum_posts (category, title, body, is_anonymous) values (%s, %s, 'body', %s) returning id"
r = run(fp, S1, args=("food", "No username", False))
check("cannot post on the board without a username", is_err(r), r)
F1 = run(fp, P, args=("hidden_gems", "Secret cafe in Ansan", False))[0][0]
F2 = run(fp, M, args=("serious", "Struggling with exams", True))[0][0]
r = run("select title, author_username, is_mine from list_forum_posts(null, 'new') order by title", S1)
check("board hides anonymous author, shows username otherwise",
      r == [("Secret cafe in Ansan", "pres_amir", False), ("Struggling with exams", None, False)], r)
r = run("select author_id from forum_posts where id=%s", S1, args=(F2,))
check("anonymous author cannot be read from the table", r == [], r)
r = run("select is_mine, author_username from get_forum_post(%s)", M, args=(F2,))
check("anonymous author still sees it is theirs", r == [(True, None)], r)
r = run("insert into forum_posts (author_id, category, title) values (%s, 'food', 'impersonate') returning id", P, args=(M,))
check("cannot post as someone else", is_err(r), r)
check("upvote", run("select vote_forum_post(%s, 1::smallint)", S1, args=(F1,)) == [(1,)])
check("vote again changes, not adds", run("select vote_forum_post(%s, 1::smallint)", S1, args=(F1,)) == [(1,)])
check("second voter", run("select vote_forum_post(%s, -1::smallint)", M, args=(F1,)) == [(0,)])
check("clear vote", run("select vote_forum_post(%s, 0::smallint)", M, args=(F1,)) == [(1,)])
run("insert into forum_comments (post_id, body, is_anonymous) values (%s, 'me too', true)", M, args=(F2,))
run("insert into forum_comments (post_id, body, is_anonymous) values (%s, 'actually it is me', false)", M, args=(F2,))
run("insert into forum_comments (post_id, body) values (%s, 'good luck!')", P, args=(F2,))
r = run("select body, author_username, is_op from list_forum_comments(%s) order by created_at", S1, args=(F2,))
check("comments: anonymous OP labelled, named OP comment never unmasks the post",
      r == [("me too", None, True), ("actually it is me", "member_m", False), ("good luck!", "pres_amir", False)], r)
r = run("delete from forum_posts where id=%s", P, args=(F2,))
check("cannot delete someone else's post", r == 0, r)
r = run("select admin_remove_forum_item('post', %s)", P, args=(F2,))
check("non-admin cannot moderate", is_err(r, "NOT_ALLOWED"), r)
run("select admin_remove_forum_item('post', %s)", A, args=(F2,))
check("admin removes a post", run("select count(*) from forum_posts", role=None) == [(1,)])
r = run("select name, members from public_club_directory() where name='Hiking Club'", None, role="anon")
check("landing page club list works signed-out", r == [("Hiking Club", 3)], r)
r = run("select title from list_forum_posts()", None, role="anon")
check("signed-out visitor reads only public Explore Korea topics", r == [("Secret cafe in Ansan",)], r)

# ---------- Visitors (non-PPMK), Team up, Explore, homepage ----------
T = new_user("tourist@x.com")
run("update profiles set account_type='visitor', username='tourist_kim', consent_at=now() where id=auth.uid()", T)
check("visitor is not a member", run("select is_member()", T) == [(False,)])
check("member is a member", run("select is_member()", M) == [(True,)])
r = run("select count(*) from events", T)
check("visitor cannot see events", r == [(0,)], r)
r = run("select count(*) from clubs", T)
check("visitor cannot see clubs", r == [(0,)], r)
r = run("select join_club(%s)", T, args=(CLUB,))
check("visitor cannot join clubs", is_err(r), r)
r = run("select * from list_club_members(%s)", T, args=(CLUB,))
check("visitor cannot list club members", r == [], r)
r = run("select set_my_rsvp(%s, 'attending')", T, args=(E1,))
check("visitor cannot RSVP", is_err(r), r)
r = run(fp, T, args=("food", "Best bibimbap in Jeonju", False))
check("visitor can post about food", not is_err(r), r)
TF = r[0][0]
r = run(fp, T, args=("hackathon", "Need a team", False))
check("visitor cannot post in Team up", is_err(r), r)
TEAM = run("""insert into forum_posts (category, title, body, link_url, deadline, looking_for)
              values ('hackathon', 'Need 2 devs for Junction Asia', 'x', 'https://example.com', '2099-01-01', 'Frontend, designer')
              returning id""", M)[0][0]
r = run("select title from list_forum_posts('group:teamup')", T)
check("visitor does not see Team up posts", r == [], r)
r = run("select looking_for from list_forum_posts('group:teamup')", P)
check("members see Team up with roles needed", r == [("Frontend, designer",)], r)
r = run("select * from get_forum_post(%s)", T, args=(TEAM,))
check("visitor cannot open a Team up post by link", r == [], r)
r = run("insert into forum_comments (post_id, body) values (%s, 'hi') returning id", T, args=(TEAM,))
check("visitor cannot comment on Team up", is_err(r), r)
r = run("select vote_forum_post(%s, 1::smallint)", T, args=(TEAM,))
check("visitor cannot vote on Team up", is_err(r, "NOT_ALLOWED"), r)
r = run("insert into forum_comments (post_id, body) values (%s, 'so good!') returning id", M, args=(TF,))
check("member comments on visitor's food post", not is_err(r), r)
r = run("select title from list_forum_posts('group:explore') order by 1", None, role="anon")
check("signed-out sees Explore Korea group", r == [("Best bibimbap in Jeonju",), ("Secret cafe in Ansan",)], r)

opp = """insert into opportunities (title, organizer, kind, scope, status) values (%s, 'AYNK', 'culture', 'korea', %s) returning id"""
r = run(opp, T, args=("Visitor listing", "suggested"))
check("visitor cannot add opportunities", is_err(r), r)
r = run(opp, M, args=("Member publishes", "published"))
check("member cannot publish directly", is_err(r), r)
SUG = run(opp, M, args=("ASEAN Youth Night", "suggested"))[0][0]
check("member suggests an opportunity", SUG is not None)
check("suggestion hidden from public", run("select count(*) from opportunities", None, role="anon") == [(0,)])
check("organizer sees suggestion", run("select count(*) from opportunities where status='suggested'", O) == [(1,)])
run("update opportunities set status='published' where id=%s", O, args=(SUG,))
r = run("select title from opportunities", None, role="anon")
check("published opportunity is public", r == [("ASEAN Youth Night",)], r)
r = run("update opportunities set title='x' where id=%s", M, args=(SUG,))
check("member cannot edit published opportunity", r == 0, r)

r = run("select count(*) from public_upcoming_events()", None, role="anon")
check("homepage shows public upcoming events signed-out", not is_err(r) and r[0][0] >= 1, r)
r = run("select title from public_upcoming_events() where title in ('Batch 2025 only', 'Custom invite')", None, role="anon")
check("homepage never shows batch-only or invite-only events", r == [], r)
r = run("select members >= 1, clubs >= 1 from public_hub_stats()", None, role="anon")
check("homepage stats work signed-out", r == [(True, True)], r)


# ---------- Photos (0005) ----------
def upload(uid, path):
    # The app creates the photos row first, then uploads the file.
    return run("insert into storage.objects (bucket_id, name) values ('photos', %s)", uid, args=(path,))
ph = "insert into photos (path, forum_post_id) values (%s, %s) returning id"
r = upload(P, f"{M}/x.jpg")
check("cannot upload into someone else's folder", is_err(r), r)
r = run(ph, P, args=(f"{P}/cafe.jpg", F1))
check("author adds a photo to own post", not is_err(r), r)
PH1 = r[0][0]
r = upload(P, f"{P}/cafe.jpg")
check("upload into own folder", not is_err(r), r)
r = run(ph, M, args=(f"{M}/m.jpg", F1))
check("cannot add photos to someone else's post", is_err(r), r)
r = run("insert into photos (path, forum_post_id, status) values (%s, %s, 'approved')", P, args=(f"{P}/sneaky.jpg", F1))
check("uploader cannot approve their own photo", is_err(r, "permission denied"), r)
check("pending photo hidden from others", run("select count(*) from photos where id=%s", S1, args=(PH1,)) == [(0,)])
check("pending photo hidden signed-out", run("select count(*) from photos", None, role="anon") == [(0,)])
check("pending file can't be downloaded by others",
      run("select count(*) from storage.objects where name=%s", S1, args=(f"{P}/cafe.jpg",)) == [(0,)])
check("uploader sees own pending photo", run("select status from photos where id=%s", P, args=(PH1,)) == [("pending",)])
check("uploader can download own pending file",
      run("select count(*) from storage.objects where name=%s", P, args=(f"{P}/cafe.jpg",)) == [(1,)])
check("admin sees pending queue", run("select count(*) from photos where status='pending'", A) == [(1,)])
r = run("select review_photo(%s, true)", P, args=(PH1,))
check("non-admin cannot approve", is_err(r, "NOT_ALLOWED"), r)
run("select review_photo(%s, true)", A, args=(PH1,))
check("approved photo visible to members", run("select count(*) from photos where id=%s", S1, args=(PH1,)) == [(1,)])
check("approved photo on Explore Korea visible signed-out", run("select count(*) from photos", None, role="anon") == [(1,)])
check("approved file downloadable signed-out",
      run("select count(*) from storage.objects where name=%s", None, role="anon", args=(f"{P}/cafe.jpg",)) == [(1,)])
# Team up post photo: approved but never visible to visitors/anon
PH2 = run(ph, M, args=(f"{M}/team.jpg", TEAM))[0][0]
upload(M, f"{M}/team.jpg")
run("select review_photo(%s, true)", A, args=(PH2,))
check("Team up photo hidden from visitors", run("select count(*) from photos where id=%s", T, args=(PH2,)) == [(0,)])
check("Team up photo hidden signed-out",
      run("select count(*) from storage.objects where name=%s", None, role="anon", args=(f"{M}/team.jpg",)) == [(0,)])
check("Team up photo visible to members", run("select count(*) from photos where id=%s", S1, args=(PH2,)) == [(1,)])
# rejected
PH3 = run(ph, P, args=(f"{P}/bad.jpg", F1))[0][0]
run("select review_photo(%s, false, 'Not appropriate')", A, args=(PH3,))
check("rejected photo hidden from others", run("select count(*) from photos where id=%s", S1, args=(PH3,)) == [(0,)])
check("uploader sees the rejection reason", run("select status, reject_reason from photos where id=%s", P, args=(PH3,)) == [("rejected", "Not appropriate")])
# club gallery: leaders only; members-only club posts stay members-only
r = run("insert into photos (path, club_id) values (%s, %s) returning id", P, args=(f"{P}/club.jpg", CLUB))
check("club president adds gallery photo", not is_err(r), r)
r = run("insert into photos (path, club_id) values (%s, %s) returning id", M, args=(f"{M}/club.jpg", CLUB))
check("ordinary member cannot add to club gallery", is_err(r), r)
PH4 = run("insert into photos (path, club_post_id) values (%s, %s) returning id", P, args=(f"{P}/cp.jpg", CP2))[0][0]
run("select review_photo(%s, true)", A, args=(PH4,))
check("members-only club post photo hidden from outsiders", run("select count(*) from photos where id=%s", S1, args=(PH4,)) == [(0,)])
check("members-only club post photo visible to club members", run("select count(*) from photos where id=%s", M, args=(PH4,)) == [(1,)])
for i in range(5):
    run(ph, P, args=(f"{P}/n{i}.jpg", F1))
r = run(ph, P, args=(f"{P}/n9.jpg", F1))
check("6 photos per post at most", is_err(r, "PHOTO_POST_LIMIT"), r)
run("select admin_remove_forum_item('post', %s)", A, args=(F1,))
check("deleting the post deletes its photo rows", run("select count(*) from photos where forum_post_id=%s", role=None, args=(F1,)) == [(0,)])


# ---------- Organisation page (0006) ----------
op = """insert into org_people (kind, sponsor, role, name, email, phone, whatsapp)
        values (%s, %s, %s, %s, 'pres@ppmk.org', '010-1111-2222', '821011112222') returning id"""
r = run(op, M, args=("committee", None, "President", "Someone"))
check("member cannot add committee members", is_err(r), r)
r = run(op, A, args=("committee", None, "President", "Ahmad"))
check("admin adds a committee member", not is_err(r), r)
run("update org_people set tier=1 where name='Ahmad'", A)
r = run("update org_people set tier=9 where name='Ahmad'", A)
check("committee level must be 1-5", is_err(r, "check"), r)
run(op, A, args=("sponsor", "MARA", "Education Officer", "Pegawai MARA"))
r = run(op, A, args=("sponsor", None, "Officer", "No sponsor"))
check("sponsor officer must say which sponsor", is_err(r, "org_people_sponsor_named"), r)
r = run("select * from org_people", M)
check("members cannot read the contacts table directly", r == [], r)
r = run("select name, email, phone, contacts_hidden from list_org_people() where kind='committee'", None, role="anon")
check("signed-out sees names but no contacts", r == [("Ahmad", None, None, True)], r)
r = run("select name, phone from list_org_people() where kind='committee'", T)
check("visitors see no contacts", r == [("Ahmad", None)], r)
r = run("select name, email, phone, whatsapp from list_org_people() where kind='committee'", M)
check("members see contacts", r == [("Ahmad", "pres@ppmk.org", "010-1111-2222", "821011112222")], r)
r = run("select sponsor, role from list_org_people() where kind='sponsor'", M)
check("MARA officer listed", r == [("MARA", "Education Officer")], r)
cal = "insert into org_calendar (title, category, start_date) values (%s, 'festive', '2099-04-01') returning id"
r = run(cal, M, args=("Hari Raya open house",))
check("member cannot edit the calendar", is_err(r), r)
r = run(cal, A, args=("Hari Raya open house",))
check("admin adds a calendar date", not is_err(r), r)
r = run("select title from org_calendar", None, role="anon")
check("calendar is public", r == [("Hari Raya open house",)], r)
r = run("delete from org_calendar", M)
check("member cannot delete calendar dates", r == 0, r)
r = run("insert into storage.objects (bucket_id, name) values ('org-photos', 'x/hack.jpg')", M)
check("member cannot upload committee photos", is_err(r), r)
r = run("insert into storage.objects (bucket_id, name) values ('org-photos', 'p1/face.jpg')", A)
check("admin uploads a committee photo", not is_err(r), r)
run("update org_people set photo_path='p1/face.jpg' where name='Ahmad'", A)
r = run("select photo_path from list_org_people() where name='Ahmad'", None, role="anon")
check("committee photo is public", r == [("p1/face.jpg",)], r)
r = run("select count(*) from storage.objects where bucket_id='org-photos'", None, role="anon")
check("committee photo file viewable signed-out", r == [(1,)], r)
r = run("update org_people set photo_path='x' where name='Ahmad'", M)
check("member cannot change committee photos", r == 0 or is_err(r), r)

# ---------- 0007: post-event feedback ----------
F1 = new_user("fb1@x.com"); F2 = new_user("fb2@x.com"); F3 = new_user("fb3@x.com")
complete(F1, "2024201", 2024); complete(F2, "2024202", 2024); complete(F3, "2024203", 2024)
fb_ins = """insert into events (title, category, event_date, start_time, location, audience)
            values (%s, 'Social', public.today_kst() + %s, '18:00', 'Hall', 'everyone') returning id"""
EF_TODAY  = run(fb_ins, O, args=("Feedback today", 0))[0][0]
EF_FUTURE = run(fb_ins, O, args=("Feedback future", 7))[0][0]
EF_OLD    = run(fb_ins, O, args=("Feedback long ago", -30))[0][0]
run("select set_my_rsvp(%s, 'attending')", F1, args=(EF_TODAY,))
run("select set_my_rsvp(%s, 'not_attending')", F2, args=(EF_TODAY,))
run("select set_my_rsvp(%s, 'attending')", F1, args=(EF_FUTURE,))
run("insert into rsvps (event_id, user_id, status) values (%s, %s, 'attending')", role=None, args=(EF_OLD, F1))

r = run("select rating from set_my_feedback(%s, 5::smallint, 'Great night!')", F1, args=(EF_TODAY,))
check("attendee rates an event on the day", r == [(5,)], r)
r = run("select rating, comment from set_my_feedback(%s, 4::smallint, 'Good, food ran out')", F1, args=(EF_TODAY,))
check("attendee can change their rating", r == [(4, "Good, food ran out")], r)
r = run("select count(*) from event_feedback where event_id=%s", role=None, args=(EF_TODAY,))
check("changing a rating does not add a second row", r == [(1,)], r)
r = run("select set_my_feedback(%s, 5::smallint)", F2, args=(EF_TODAY,))
check("someone who said 'can't go' cannot rate", is_err(r, "FEEDBACK_CLOSED"), r)
r = run("select set_my_feedback(%s, 5::smallint)", F3, args=(EF_TODAY,))
check("someone with no RSVP cannot rate", is_err(r, "FEEDBACK_CLOSED"), r)
r = run("select set_my_feedback(%s, 5::smallint)", F1, args=(EF_FUTURE,))
check("cannot rate an event that hasn't happened", is_err(r, "FEEDBACK_CLOSED"), r)
r = run("select set_my_feedback(%s, 5::smallint)", F1, args=(EF_OLD,))
check("cannot rate more than 14 days after", is_err(r, "FEEDBACK_CLOSED"), r)
run("select check_in(%s, %s)", O, args=(EF_TODAY, F2))
r = run("select rating from set_my_feedback(%s, 3::smallint)", F2, args=(EF_TODAY,))
check("checked-in person can rate even after saying 'can't go'", r == [(3,)], r)
r = run("select set_my_feedback(%s, 6::smallint)", F2, args=(EF_TODAY,))
check("rating must be 1-5", is_err(r, "check"), r)
r = run("select set_my_feedback(%s, 5::smallint)", T, args=(EF_TODAY,))
check("visitor cannot rate", is_err(r, "FEEDBACK_CLOSED"), r)
r = run("select set_my_feedback(%s, 5::smallint)", None, role="anon", args=(EF_TODAY,))
check("signed-out cannot rate", is_err(r, "permission denied"), r)
r = run("insert into event_feedback (event_id, user_id, rating) values (%s, auth.uid(), 5)", F3, args=(EF_TODAY,))
check("no direct inserts (only through the function)", is_err(r, "permission denied"), r)
r = run("update event_feedback set rating=1", F1)
check("no direct updates", is_err(r, "permission denied"), r)

r = run("select user_id, rating from event_feedback", F1)
check("student reads only their own feedback", r == [(F1, 4)], r)
r = run("select count(*) from event_feedback", O)
check("organizer cannot read the table (stays anonymous)", r == [(0,)], r)
r = run("select responses, average, stars_3, stars_4 from event_feedback_summary(%s)", O, args=(EF_TODAY,))
check("organizer sees count and average", r == [(2, 3.5, 1, 1)], r)
r = run("select * from event_feedback_comments(%s)", O, args=(EF_TODAY,))
check("organizer sees comments without names", len(r) == 1 and r[0][:2] == (4, "Good, food ran out") and len(r[0]) == 3, r)
r = run("select * from event_feedback_summary(%s)", F1, args=(EF_TODAY,))
check("student cannot see the summary", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from event_feedback_comments(%s)", F1, args=(EF_TODAY,))
check("student cannot see others' comments", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from feedback_overview()", O)
check("organizer cannot see the hub overview", is_err(r, "NOT_ALLOWED"), r)
r = run("select responses, average, events_rated from feedback_overview()", A)
check("admin sees the hub overview", r == [(2, 3.5, 1)], r)
r = run("select can_give_feedback(%s), can_give_feedback(%s)", F1, args=(EF_TODAY, EF_FUTURE))
check("app can ask 'may I rate this?'", r == [(True, False)], r)

# ---------- 0008: QR check-in ----------
Q1 = new_user("qr1@x.com"); Q2 = new_user("qr2@x.com")
complete(Q1, "2024301", 2024); complete(Q2, "2024302", 2024)
EQ = run(fb_ins, O, args=("QR night", 0))[0][0]
run("select set_my_rsvp(%s, 'attending')", Q1, args=(EQ,))
run("select set_my_rsvp(%s, 'maybe')", Q2, args=(EQ,))
r = run("select checkin_code from rsvps where event_id=%s", Q1, args=(EQ,))
check("student can read their own check-in code", len(r) == 1 and r[0][0] is not None, r)
CODE1 = r[0][0]
CODE2 = run("select checkin_code from rsvps where event_id=%s", Q2, args=(EQ,))[0][0]
check("every RSVP gets a different code", CODE1 != CODE2)
r = run("select checkin_code from rsvps where event_id=%s and user_id=%s", Q1, args=(EQ, Q2))
check("student cannot read someone else's code", r == [], r)
r = run("update rsvps set checkin_code=gen_random_uuid() where user_id=auth.uid()", Q1)
check("student cannot change their code", is_err(r, "permission denied"), r)
r = run("select * from check_in_by_code(%s)", Q1, args=(CODE1,))
check("student cannot check themselves in by scanning", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from check_in_by_code(%s)", None, role="anon", args=(CODE1,))
check("signed-out cannot use a code", is_err(r, "permission denied"), r)
r = run("select full_name, student_id, status, already_checked_in, checked_in_at is not null from check_in_by_code(%s)", O, args=(CODE1,))
check("organizer scans and checks the student in", r == [("Student 2024301", "2024301", "attending", False, True)], r)
first = run("select checked_in_at from rsvps where event_id=%s and user_id=%s", role=None, args=(EQ, Q1))[0][0]
r = run("select already_checked_in, checked_in_at from check_in_by_code(%s)", O, args=(CODE1,))
check("scanning twice says 'already checked in' and keeps the first time", r == [(True, first)], r)
r = run("select status, already_checked_in from check_in_by_code(%s)", A, args=(CODE2,))
check("admin can scan too; shows the person said maybe", r == [("maybe", False)], r)
r = run("select * from check_in_by_code(gen_random_uuid())", O)
check("unknown code is rejected", is_err(r, "BAD_CHECKIN_CODE"), r)
r = run("select count(*) from rsvps where event_id=%s and checked_in_at is not null", role=None, args=(EQ,))
check("both scans recorded", r == [(2,)], r)

# ---------- 0009: reminder emails ----------
SECRET = "test-secret-" + "x" * 40
run("insert into private.job_secrets (name, secret_hash) values ('reminders', encode(sha256(convert_to(%s, 'UTF8')), 'hex'))", role=None, args=(SECRET,))
R1 = new_user("rem1@x.com"); R2 = new_user("rem2@x.com"); R3 = new_user("rem3@x.com"); R4 = new_user("rem4@x.com")
for u, sid in [(R1, "2024401"), (R2, "2024402"), (R3, "2024403"), (R4, "2024404")]:
    complete(u, sid, 2024)
ER_TMR   = run(fb_ins, O, args=("Futsal tomorrow", 1))[0][0]
ER_LATER = run(fb_ins, O, args=("Futsal next week", 7))[0][0]
run("select set_my_rsvp(%s, 'attending')", R1, args=(ER_TMR,))
run("select set_my_rsvp(%s, 'maybe')", R2, args=(ER_TMR,))
run("select set_my_rsvp(%s, 'not_attending')", R3, args=(ER_TMR,))
run("select set_my_rsvp(%s, 'attending')", R4, args=(ER_TMR,))
run("select set_my_rsvp(%s, 'attending')", R1, args=(ER_LATER,))
r = run("update profiles set email_reminders=false where id=auth.uid()", R4)
check("student can turn reminders off", r == 1, r)
r = run("update profiles set email_reminders=false where id=%s", R4, args=(R1,))
check("student cannot turn off someone else's reminders", r == 0, r)

due = "select email, status::text from reminders_due(%s) where event_id in (%s, %s) order by email"
r = run(due, None, role="anon", args=(SECRET, ER_TMR, ER_LATER))
check("job (signed-out + secret) gets going & maybe for tomorrow only", r == [("rem1@x.com", "attending"), ("rem2@x.com", "maybe")], r)
r = run("select * from reminders_due(%s)", None, role="anon", args=("wrong-secret-" + "y" * 40,))
check("wrong secret is refused", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from reminders_due(%s)", None, role="anon", args=("",))
check("empty secret is refused", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from reminders_due(%s)", R1, args=("guess",))
check("a signed-in student cannot fetch the list", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from private.job_secrets", None, role="anon")
check("signed-out cannot read the secret table", is_err(r, "permission denied"), r)
r = run("select * from private.job_secrets", A)
check("even admins cannot read the secret table via the API", is_err(r, "permission denied"), r)
r = run("select * from private.reminders_sent", A)
check("reminder log is not reachable via the API", is_err(r, "permission denied"), r)
r = run("select private.job_secret_ok('reminders', %s)", None, role="anon", args=(SECRET,))
check("secret checker cannot be called directly", is_err(r, "permission denied"), r)

r = run("select mark_reminded(%s, %s, %s)", None, role="anon", args=(SECRET, ER_TMR, R1))
check("job marks R1 as reminded", not is_err(r), r)
r = run("select mark_reminded(%s, %s, %s)", None, role="anon", args=(SECRET, ER_TMR, R1))
check("marking twice is harmless", not is_err(r), r)
r = run(due, None, role="anon", args=(SECRET, ER_TMR, ER_LATER))
check("reminded people are not sent a second email", r == [("rem2@x.com", "maybe")], r)
r = run("select mark_reminded(%s, %s, %s)", R2, args=("guess" * 10, ER_TMR, R2))
check("cannot mark reminded without the secret", is_err(r, "NOT_ALLOWED"), r)
before = run("select updated_at from rsvps where event_id=%s and user_id=%s", role=None, args=(ER_TMR, R2))[0][0]
run("select mark_reminded(%s, %s, %s)", None, role="anon", args=(SECRET, ER_TMR, R2))
after = run("select updated_at from rsvps where event_id=%s and user_id=%s", role=None, args=(ER_TMR, R2))[0][0]
check("reminding doesn't change the RSVP's 'responded at' time", before == after, (before, after))

print(f"\n{fails} failing checks")
sys.exit(1 if fails else 0)
