Feature: Prevent overlapping bookings
  As a user
  I want the system to reject overlapping reservations for the same room
  So that room schedules remain consistent

  Scenario: Reject an overlapping booking for the same room
    Given user "ana@example.com" has booked "Sala A" on "2026-10-15" from "10:00" to "11:00"
    When user "bob@example.com" tries to book "Sala A" on "2026-10-15" from "10:30" to "11:30"
    Then the response status should be 409

  Scenario: Allow adjacent bookings
    Given user "ana@example.com" has booked "Sala A" on "2026-10-15" from "10:00" to "11:00"
    When user "bob@example.com" tries to book "Sala A" on "2026-10-15" from "11:00" to "12:00"
    Then the response status should be 201

  Scenario: Allow the same time in another room
    Given user "ana@example.com" has booked "Sala A" on "2026-10-15" from "10:00" to "11:00"
    When user "bob@example.com" tries to book "Sala B" on "2026-10-15" from "10:00" to "11:00"
    Then the response status should be 201
