Feature: Authenticate users and authorize access by role
  As a coworking user
  I want to authenticate and access only permitted resources
  So that my account and bookings remain protected

  Scenario: Login and view my profile with a JWT
    Given user "ana@example.com" exists
    When user "ana@example.com" logs in with password "secret123"
    Then the response status should be 200
    And the response should contain a JWT token
    When I request the profile using that token
    Then the response status should be 200
    And the profile role should be "USER"

  Scenario: Reject invalid login credentials
    Given user "ana@example.com" exists
    When user "ana@example.com" logs in with password "wrong-password"
    Then the response status should be 401

  Scenario: Rotate refresh tokens and reject reuse
    Given user "ana@example.com" exists
    When user "ana@example.com" logs in with password "secret123"
    Then the response status should be 200
    And the response should contain a refresh token
    When I refresh using the current refresh token
    Then the response status should be 200
    And the response should contain a JWT token
    When I reuse the previous refresh token
    Then the response status should be 401

  Scenario: Revoke a refresh token on logout
    Given user "ana@example.com" exists
    When user "ana@example.com" logs in with password "secret123"
    And I log out using the current refresh token
    Then the response status should be 204
    When I try to refresh after logging out
    Then the response status should be 401

  Scenario: Ignore a client-supplied privileged role during registration
    When I register "Eve" with email "eve@example.com", password "secret123", and requested role "ADMIN"
    Then the response status should be 201
    And the registered user role should be "USER"

  Scenario: Reject malformed bearer tokens
    Given the coworking rooms are available
    When I attempt to book "Sala A" with an invalid token on "2026-10-15" from "10:00" to "11:00"
    Then the response status should be 403

  Scenario: Allow trusted admins to list all bookings
    Given a trusted "ADMIN" account exists with email "admin@example.com"
    When the "ADMIN" user "admin@example.com" requests all bookings
    Then the response status should be 200
    And the response should contain 0 booking

  Scenario: Allow editors to read all bookings
    Given a trusted "EDITOR" account exists with email "editor@example.com"
    When the "EDITOR" user "editor@example.com" requests all bookings
    Then the response status should be 200
    And the response should contain 0 booking

  Scenario: Deny regular users access to admin booking data
    Given user "ana@example.com" exists
    When the USER "ana@example.com" requests all bookings
    Then the response status should be 403
