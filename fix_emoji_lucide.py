import os

def svg(path, size=20):
    return f'<svg width="{size}" height="{size}" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="{path}"/></svg>'

ICONS = {
    'users':    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    'calendar': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    'search':   'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z',
    'popcorn':  'M18 8a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2h12a2 2 0 012 2zM6 10l-1 11h14l-1-11',
    'ticket':   'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
}

fixes = {
    'src/app/core/services/auth.service.ts': [
        ('\u26a0 No token', 'No token'),
    ],
    'src/app/features/tickets/verify-ticket/verify-ticket.ts': [
        ('\u2318+V', 'Cmd+V'),
        ('\U0001f550', ''),
    ],
    'src/app/features/landing/landing.ts': [
        ('4.9\u2605', '4.9'),
    ],
    'src/app/features/user-dashboard/meetups/meetups-page.ts': [
        ('<p class="mp-empty__ico">\U0001f91d</p>', '<div class="mp-empty__ico">' + svg(ICONS['users'], 32) + '</div>'),
    ],
    'src/app/features/user-dashboard/my-created-meetups/my-created-meetups.ts': [
        ('\U0001f3e2 In-Person', 'In-Person'),
        ('Meetup updated \u2713', 'Meetup updated'),
    ],
    'src/app/features/user-dashboard/my-meetups/my-meetups.ts': [
        ('<p class="mm-empty__ico">\U0001f4c5</p>', '<div class="mm-empty__ico">' + svg(ICONS['calendar'], 32) + '</div>'),
    ],
    'src/app/features/user-dashboard/my-memberships/my-memberships.ts': [
        ('<p class="mm-empty__ico">\U0001f50d</p>', '<div class="mm-empty__ico">' + svg(ICONS['search'], 32) + '</div>'),
        ('Join request sent \u2713', 'Join request sent'),
    ],
    'src/app/features/user-dashboard/user-dashboard-home/user-dashboard-home.ts': [
        ('<p class="udh-empty__ico">\U0001f3ad</p>', '<div class="udh-empty__ico">' + svg(ICONS['popcorn'], 32) + '</div>'),
    ],
    'src/app/features/event-detail/event-detail.ts': [
        ('<span>\U0001f39f\ufe0f</span>', '<span>' + svg(ICONS['ticket'], 16) + '</span>'),
    ],
    'src/app/features/events/modals/view-event-modal.ts': [
        ('\U0001f4cd In-Person', 'In-Person'),
    ],
    'src/app/shared/components/app-sidebar/app-sidebar.component.ts': [
        ('// \U0001f447 Default', '// Default'),
    ],
}

for path, replacements in fixes.items():
    if not os.path.exists(path):
        print(f'MISSING: {path}')
        continue
    text = open(path, encoding='utf-8').read()
    new = text
    for old, new_val in replacements:
        new = new.replace(old, new_val)
    if new != text:
        open(path, 'w', encoding='utf-8').write(new)
        print(f'patched: {path}')
    else:
        print(f'no match: {path}')
